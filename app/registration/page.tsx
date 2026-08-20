"use client";

import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import logoImage from "@/image/logo.png";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  formatWorkshopDate,
  isOnsiteStatusWorkshop,
  isRegistrationStatusWorkshop,
  mergeWorkshopCatalog,
  ONSITE_STATUS_WORKSHOP_CODE,
  ONSITE_STATUS_WORKSHOP_NAME,
  ONSITE_STATUS_WORKSHOP_TITLE,
  type WorkshopRecord,
} from "@/lib/workshops";

const navLinks = ["Home", "About", "Speakers", "Schedule", "Registration", "รายชื่อผู้เข้าอบรม", "Contact"];

function navHref(item: string): string {
  if (item === "Home") {
    return "/";
  }

  if (item === "Registration") {
    return "/registration";
  }

  if (item === "รายชื่อผู้เข้าอบรม") {
    return "/attendees";
  }

  return `/#${item.toLowerCase()}`;
}

const strictEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const thaiNameRegex = /^[\u0E01-\u0E3A\u0E40-\u0E4C\u0E47-\u0E4E\s]+$/u;
const thaiTitleRegex = /^[\u0E01-\u0E3A\u0E40-\u0E4C\u0E47-\u0E4E.\s]+$/u;
const ONSITE_REGISTRATION_OPEN_KEY = "library-ai-lab-onsite-registration-open";
type TopicAttendanceMode = "onsite" | "recording";

function isValidThaiName(value: string, allowPeriods = false): boolean {
  return (allowPeriods ? thaiTitleRegex : thaiNameRegex).test(value);
}

export default function RegistrationPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicAttendanceMode, setTopicAttendanceMode] = useState<Record<string, TopicAttendanceMode>>({});
  const [topicSelectionError, setTopicSelectionError] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [availableWorkshops, setAvailableWorkshops] = useState<WorkshopRecord[]>([]);
  const [isWorkshopLoading, setIsWorkshopLoading] = useState(true);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);
  const [isOnsiteRegistrationOpen, setIsOnsiteRegistrationOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const savedOnsiteState = window.localStorage.getItem(ONSITE_REGISTRATION_OPEN_KEY);
    return savedOnsiteState === null ? true : savedOnsiteState === "true";
  });

  const organizationRequired = selectedRole === "student" || selectedRole === "staff";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadWorkshops() {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          return;
        }

        const { data, error } = await supabase
          .from("workshops")
          .select("id, code, title, topic_name, event_date, is_active")
          .order("event_date", { ascending: true });

        if (error) {
          throw error;
        }

        if (!isActive) {
          return;
        }

        const hasRegistrationStatusRow = (data ?? []).some((workshop) => isRegistrationStatusWorkshop(workshop));
        if (!hasRegistrationStatusRow) {
          const { error: upsertError } = await supabase.from("workshops").upsert(
            {
              code: "register-status",
              title: "ครั้งที่ 0",
              topic_name: "Register status",
              event_date: "2026-01-01",
              is_active: true,
            },
            { onConflict: "code" },
          );

          if (upsertError) {
            throw upsertError;
          }
        }

        const hasOnsiteStatusRow = (data ?? []).some((workshop) => isOnsiteStatusWorkshop(workshop));
        if (!hasOnsiteStatusRow) {
          const { error: upsertError } = await supabase.from("workshops").upsert(
            {
              code: ONSITE_STATUS_WORKSHOP_CODE,
              title: ONSITE_STATUS_WORKSHOP_TITLE,
              topic_name: ONSITE_STATUS_WORKSHOP_NAME,
              event_date: "2026-01-01",
              is_active: true,
            },
            { onConflict: "code" },
          );

          if (upsertError) {
            throw upsertError;
          }
        }

        const mergedWorkshops = mergeWorkshopCatalog(data);
        const registrationStatusWorkshop = mergedWorkshops.find(isRegistrationStatusWorkshop) ?? null;
        const onsiteStatusWorkshop = mergedWorkshops.find(isOnsiteStatusWorkshop) ?? null;
        setIsRegistrationOpen(registrationStatusWorkshop ? Boolean(registrationStatusWorkshop.is_active) : true);
        setIsOnsiteRegistrationOpen(onsiteStatusWorkshop ? Boolean(onsiteStatusWorkshop.is_active) : true);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(ONSITE_REGISTRATION_OPEN_KEY, String(onsiteStatusWorkshop ? Boolean(onsiteStatusWorkshop.is_active) : true));
        }
        const activeWorkshops = mergedWorkshops.filter(
          (workshop) => workshop.is_active && !isRegistrationStatusWorkshop(workshop) && !isOnsiteStatusWorkshop(workshop),
        );
        setAvailableWorkshops(activeWorkshops);
      } catch {
        if (!isActive) {
          return;
        }

        setIsRegistrationOpen(true);
        setIsOnsiteRegistrationOpen(true);
      } finally {
        if (isActive) {
          setIsWorkshopLoading(false);
        }
      }
    }

    void loadWorkshops();

    return () => {
      isActive = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const title = String(formData.get("title") ?? "").trim();
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const fullName = [title, firstName, lastName].filter(Boolean).join(" ");
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const phone = String(formData.get("phone") ?? "").trim();
    const organization = String(formData.get("organization") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim();
    const selectedTopicCodes = formData
      .getAll("topics")
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0);
    const selectedTopicModes = Object.fromEntries(
      selectedTopicCodes.map((code) => {
        const modeValue = String(formData.get(`attendance-${code}`) ?? "");
        return [code, modeValue === "recording" ? "recording" : modeValue === "onsite" ? "onsite" : ""] as const;
      }),
    ) as Record<string, TopicAttendanceMode | "">;

    if (!title || !firstName || !lastName) {
      setSubmitted(false);
      return;
    }

    if (!isValidThaiName(title, true) || !isValidThaiName(firstName) || !isValidThaiName(lastName)) {
      setSubmitted(false);
      return;
    }

    if (!strictEmailRegex.test(email)) {
      setSubmitted(false);
      return;
    }

    if ((role === "student" || role === "staff") && !organization) {
      setSubmitted(false);
      return;
    }

    if (selectedTopicCodes.length === 0) {
      setSubmitted(false);
      setTopicSelectionError("กรุณาเลือกหัวข้อที่สนใจอย่างน้อย 1 รายการ");
      return;
    }

    const missingAttendanceMode = selectedTopicCodes.find((code) => !selectedTopicModes[code]);
    if (missingAttendanceMode) {
      setSubmitted(false);
      setTopicSelectionError("กรุณาเลือกวิธีเข้าร่วมสำหรับหัวข้อที่สนใจทุกหัวข้อ ก่อนส่งข้อมูลสมัคร");
      return;
    }

    const disabledOnsiteTopic = selectedTopicCodes.find((code) => selectedTopicModes[code] === "onsite" && !isOnsiteRegistrationOpen);
    if (disabledOnsiteTopic) {
      setSubmitted(false);
      setTopicSelectionError("การสมัคร On-site ถูกปิดชั่วคราว กรุณาเลือก รับชมบันทึกการอบรมย้อนหลัง แทน");
      return;
    }

    setTopicSelectionError("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setSubmitted(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: workshops, error: workshopsError } = await supabase
        .from("workshops")
        .select("id, code")
        .eq("is_active", true)
        .in("code", selectedTopicCodes);

      if (workshopsError) {
        throw workshopsError;
      }

      if (!workshops || workshops.length !== selectedTopicCodes.length) {
        throw new Error("ไม่พบข้อมูลหัวข้ออบรมในฐานข้อมูล กรุณา seed ตาราง workshops ก่อนใช้งาน");
      }

      const registrationId = crypto.randomUUID();

      const { error: registrationError } = await supabase
        .from("registrations")
        .insert({
          id: registrationId,
          full_name: fullName,
          email,
          phone,
          organization,
          role,
        });

      if (registrationError) {
        throw registrationError;
      }

      const topicRows = workshops.map((workshop) => ({
        registration_id: registrationId,
        workshop_id: workshop.id,
        status: selectedTopicModes[workshop.code] === "recording" ? "Record" : "Onsite",
      }));

      const { error: topicInsertError } = await supabase.from("registration_topics").insert(topicRows);
      if (topicInsertError) {
        throw topicInsertError;
      }

      setSubmitted(true);
      setSelectedTopics([]);
      setTopicAttendanceMode({});
      setSelectedRole("");
      formElement.reset();
    } catch {
      setSubmitted(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTopicToggle = (topicId: string, checked: boolean) => {
    setTopicSelectionError("");

    setSelectedTopics((prev) => {
      if (checked) {
        if (prev.includes(topicId)) {
          return prev;
        }

        return [...prev, topicId];
      }

      setTopicAttendanceMode((current) => {
        const next = { ...current };
        delete next[topicId];
        return next;
      });

      return prev.filter((item) => item !== topicId);
    });
  };

  return (
    <div className="relative">
      <header
        className={[
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled ? "bg-[#061B4D]/65 backdrop-blur-xl border-b border-white/10" : "bg-transparent",
        ].join(" ")}
      >
        <div className="section-shell flex h-20 items-center justify-between">
          <Link href="/" className="focus-ring flex items-center gap-3 rounded-full px-3 py-2 text-sm font-semibold tracking-[0.2em] text-white" aria-label="Go to home section">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl sm:h-40 sm:w-40">
              <Image
                src={logoImage}
                alt="LIBRARY AI LAB logo"
                width={220}
                height={220}
                sizes="(max-width: 640px) 128px, 160px"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="hidden sm:inline">LIBRARY AI LAB</span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
            {navLinks.map((item) => (
              <Link
                key={item}
                className="focus-ring rounded-full px-2 py-1 text-sm text-zinc-200 transition hover:text-[#56A6FF]"
                href={navHref(item)}
              >
                {item}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div id="mobile-menu" className="section-shell pb-5 md:hidden">
            <div className="glass-card p-4">
              <div className="flex flex-col gap-2">
                {navLinks.map((item) => (
                  <Link
                    key={item}
                    href={navHref(item)}
                    className="focus-ring rounded-xl px-4 py-2 text-sm text-zinc-100 hover:bg-white/8"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="relative min-h-screen overflow-hidden py-24 pt-28">
        <div className="bg-wave" aria-hidden="true" />
        <section className="section-shell relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="glass-card mx-auto max-w-4xl p-6 sm:p-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm tracking-[0.2em] text-[#56A6FF]">REGISTRATION FORM</p>
              <h1 className="mt-2 font-(family-name:--font-poppins) text-3xl font-bold text-white sm:text-4xl">แบบฟอร์มรับสมัคร LIBRARY AI LAB</h1>
              <p className="mt-3 max-w-2xl text-zinc-300">กรอกข้อมูลเพื่อแสดงความประสงค์เข้าร่วมกิจกรรม ข้อมูลจะถูกบันทึกลงระบบเมื่อส่งแบบฟอร์มสำเร็จ</p>
            </div>
            <Link
              href="/"
              className="focus-ring inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-zinc-100 transition hover:border-[#43D5FF]/50 hover:text-[#56A6FF]"
            >
              กลับหน้าแรก
            </Link>
          </div>

          {!isRegistrationOpen ? (
            <div className="mt-8 rounded-3xl border border-amber-400/30 bg-amber-500/10 p-6 text-center">
              <p className="text-2xl font-bold text-[#FFE4B5]">ปิดรับสมัคร</p>
              <p className="mt-3 text-base text-zinc-200">
                เปิดรับสมัครใหม่อีกครั้ง
                <br />
                เร็ว ๆ นี้
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
              <div className="grid gap-5 md:grid-cols-[minmax(120px,0.8fr)_minmax(0,1.4fr)_minmax(0,1.4fr)]">
                <label className="grid gap-2 md:col-span-1">
                  <span className="text-sm font-semibold text-zinc-100">คำนำหน้านาม</span>
                  <input
                    name="title"
                    required
                    className="focus-ring w-full max-w-[140px] rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-zinc-100 placeholder:text-zinc-400"
                    placeholder="เช่น นาย"
                    pattern="^[\u0E01-\u0E3A\u0E40-\u0E4C\u0E47-\u0E4E.\s]+$"
                    title="กรุณากรอกคำนำหน้านามเป็นภาษาไทยและใช้จุด (.) ได้"
                  />
                </label>

                <label className="grid gap-2 md:col-span-1">
                  <span className="text-sm font-semibold text-zinc-100">ชื่อ</span>
                  <input
                    name="firstName"
                    required
                    className="focus-ring w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-zinc-100 placeholder:text-zinc-400"
                    placeholder="เช่น สมชาย"
                    pattern="^[\u0E01-\u0E3A\u0E40-\u0E4C\u0E47-\u0E4E\s]+$"
                    title="กรุณากรอกชื่อเป็นภาษาไทยเท่านั้น"
                  />
                </label>

                <label className="grid gap-2 md:col-span-1">
                  <span className="text-sm font-semibold text-zinc-100">นามสกุล</span>
                  <input
                    name="lastName"
                    required
                    className="focus-ring w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-zinc-100 placeholder:text-zinc-400"
                    placeholder="เช่น ใจดี"
                    pattern="^[\u0E01-\u0E3A\u0E40-\u0E4C\u0E47-\u0E4E\s]+$"
                    title="กรุณากรอกนามสกุลเป็นภาษาไทยเท่านั้น"
                  />
                </label>

                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-semibold text-zinc-100">อีเมล</span>
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    pattern="^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"
                    title="กรุณาใส่อีเมลที่ถูกต้อง (เช่น name@example.com)"
                    className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-zinc-100 placeholder:text-zinc-400"
                    placeholder="name@example.com"
                  />
                </label>

                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-semibold text-zinc-100">หมายเลขโทรศัพท์</span>
                  <input
                    name="phone"
                    required
                    type="tel"
                    pattern="(02[0-9]{7}|0[3457][0-9]{7}|0[689][0-9]{8})( ?(ต่อ|ext\.?|#) ?[0-9]+)?"
                    title="กรุณาใส่เบอร์โทรที่ถูกต้อง: บ้าน (02xxxxxxx) หรือ (03X-07Xxxxxxxx) หรือมือถือ (06X/08X/09Xxxxxxxxx) เช่น 0812345678"
                    className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-zinc-100 placeholder:text-zinc-400"
                    placeholder="08xxxxxxxx"
                  />
                </label>

                <div className="grid gap-5 md:col-span-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-zinc-100">
                      หน่วยงาน/คณะ {organizationRequired ? <span className="text-[#56A6FF]">*</span> : null}
                    </span>
                    <input
                      name="organization"
                      required={organizationRequired}
                      className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-zinc-100 placeholder:text-zinc-400"
                      placeholder="ระบุหน่วยงานหรือคณะ"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-zinc-100">สถานะผู้สมัคร</span>
                    <select
                      name="role"
                      required
                      value={selectedRole}
                      onChange={(event) => setSelectedRole(event.target.value)}
                      className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-zinc-100"
                    >
                      <option value="" disabled className="text-black">
                        เลือกสถานะ
                      </option>
                      <option value="student" className="text-black">
                        นักศึกษามหาวิทยาลัยมหิดล
                      </option>
                      <option value="staff" className="text-black">
                        บุคลากรมหาวิทยาลัยมหิดล
                      </option>
                      <option value="school-network" className="text-black">
                        ครู/นักเรียน เครือข่ายความร่วมมือ
                      </option>
                      <option value="general" className="text-black">
                        บุคคลทั่วไป/ผู้สนใจ
                      </option>
                    </select>
                  </label>
                </div>
              </div>

            <fieldset className="rounded-2xl border border-white/20 bg-white/8 p-4">
              <legend className="px-2 text-sm font-semibold text-zinc-100">หัวข้อที่สนใจ</legend>
              {isWorkshopLoading ? (
                <p className="mt-4 text-sm text-zinc-300">กำลังโหลดหัวข้ออบรม...</p>
              ) : availableWorkshops.length === 0 ? (
                <p className="mt-4 text-sm text-amber-200">ยังไม่มีหัวข้อที่เปิดรับสมัครจากระบบ Admin</p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {availableWorkshops.map((workshop) => {
                    const isSelected = selectedTopics.includes(workshop.code);
                    const selectedMode = topicAttendanceMode[workshop.code];

                    return (
                      <div key={workshop.id} className="rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/8">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            name="topics"
                            value={workshop.code}
                            checked={isSelected}
                            onChange={(event) => handleTopicToggle(workshop.code, event.target.checked)}
                            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#43D5FF]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-[#56A6FF]">{workshop.title}</p>
                            <p className="text-sm font-medium text-zinc-100">{workshop.topic_name}</p>
                            <p className="text-xs text-zinc-400">📅 {formatWorkshopDate(workshop.event_date)}</p>
                          </div>
                        </label>

                        {isSelected && (
                          <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-[#08182D]/70 p-3">
                            <p className="text-xs font-semibold text-zinc-200">เลือกการเข้าร่วม</p>
                            <label className="flex items-center gap-2 text-sm text-zinc-100">
                              <input
                                type="radio"
                                name={`attendance-${workshop.code}`}
                                value="onsite"
                                checked={selectedMode === "onsite"}
                                onChange={() => setTopicAttendanceMode((current) => ({ ...current, [workshop.code]: "onsite" }))}
                                disabled={!isOnsiteRegistrationOpen}
                                className="h-4 w-4 accent-[#43D5FF] disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <span className={isOnsiteRegistrationOpen ? "" : "text-zinc-500 line-through"}>เข้าร่วมอบรม On-site</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-100">
                              <input
                                type="radio"
                                name={`attendance-${workshop.code}`}
                                value="recording"
                                checked={selectedMode === "recording"}
                                onChange={() => setTopicAttendanceMode((current) => ({ ...current, [workshop.code]: "recording" }))}
                                className="h-4 w-4 accent-[#43D5FF]"
                              />
                              <span>รับชมบันทึกการอบรมย้อนหลัง</span>
                            </label>
                            {!isOnsiteRegistrationOpen ? (
                              <p className="text-xs text-amber-200">ปิดการรับสมัคร On-site โดยให้เลือกรับชมบันทึกการอบรมย้อนหลังเท่านั้น</p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-4 text-xs text-zinc-400">เลือกแล้ว {selectedTopics.length} รายการ</p>
              {topicSelectionError ? <p className="mt-3 text-sm text-red-300">{topicSelectionError}</p> : null}
            </fieldset>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="focus-ring inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#2F7CFF] to-[#43D5FF] px-7 py-3 font-semibold text-white shadow-[0_0_30px_rgba(67,213,255,0.5)] transition hover:scale-105 hover:shadow-[0_0_38px_rgba(67,213,255,0.65)]"
              >
                {isSubmitting ? "ระบบกำลังบันทึกข้อมูลการสมัคร" : "ส่งข้อมูลสมัคร"}
              </button>
            </div>

          </form>
          )}

          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-6 rounded-2xl border border-[#43D5FF]/30 bg-[#43D5FF]/10 p-4 text-[#D4E6FF]"
            >
              ระบบทำกาบันทึกข้อมูลการสมัครเรียบร้อยแล้ว
            </motion.div>
          )}
        </motion.div>
        </section>
      </main>
    </div>
  );
}
