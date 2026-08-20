"use client";

import { motion } from "framer-motion";
import { Loader2, Menu, RefreshCw, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import logoImage from "@/image/logo.png";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatTopicLabel, mergeWorkshopCatalog, type TopicStatus, type WorkshopRecord } from "@/lib/workshops";

type Attendee = {
  id: string;
  full_name: string;
  topicCode: string;
  topicLabel: string;
  status: TopicStatus;
  createdAt: string;
};

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return "ไม่สามารถโหลดรายชื่อผู้เข้าอบรมได้";
}

const ONSITE_ATTENDANCE_LABEL = "เข้าร่วมอบรม Onsite";
const RESERVE_RECORDING_LABEL = "ผู้มีสิทธิ์ดูบันทึกการอบรมย้อนหลัง";
const ATTENDEE_STATUS_ORDER: Record<TopicStatus, number> = {
  Onsite: 0,
  Waiting: 1,
  Record: 2,
};

function getAttendeeRegistrationLabel(status: TopicStatus): string {
  return status === "Onsite" ? ONSITE_ATTENDANCE_LABEL : RESERVE_RECORDING_LABEL;
}

export default function AttendeesPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadAttendees() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          throw new Error("ระบบยังไม่พร้อมใช้งาน: ยังไม่ได้ตั้งค่า Supabase Environment Variables");
        }

        const [
          { data: registrations, error: registrationsError },
          { data: registrationTopics, error: registrationTopicsError },
          { data: workshopData, error: workshopsError },
        ] = await Promise.all([
          supabase.from("registrations").select("id, full_name, created_at").order("created_at", { ascending: true }),
          supabase.from("registration_topics").select("registration_id, workshop_id, status"),
          supabase.from("workshops").select("id, code, topic_name, title, event_date, is_active").order("event_date", { ascending: true }),
        ]);

        if (registrationsError) {
          throw registrationsError;
        }

        if (registrationTopicsError) {
          throw registrationTopicsError;
        }

        if (workshopsError) {
          throw workshopsError;
        }

        if (!isActive) {
          return;
        }

        const mergedWorkshops = mergeWorkshopCatalog(workshopData);
        const activeWorkshopCodes = new Set(mergedWorkshops.filter((workshop) => workshop.is_active).map((workshop) => workshop.code));

        const registrationById = new Map((registrations ?? []).map((registration) => [registration.id, registration]));
        const workshopById = new Map(
          mergedWorkshops
            .filter((workshop): workshop is WorkshopRecord & { id: string } => Boolean(workshop.id))
            .map((workshop) => [workshop.id, workshop]),
        );

        const rows = (registrationTopics ?? [])
          .map((topicRow) => {
            const registration = registrationById.get(topicRow.registration_id);
            const workshop = workshopById.get(topicRow.workshop_id);

            if (!registration || !workshop) {
              return null;
            }

            if (!activeWorkshopCodes.has(workshop.code)) {
              return null;
            }

            const baseLabel = formatTopicLabel(workshop.topic_name || workshop.title || workshop.code);

            return {
              id: `${topicRow.registration_id}-${topicRow.workshop_id}`,
              full_name: registration.full_name,
              topicCode: workshop.code,
              topicLabel: baseLabel,
              status: topicRow.status as TopicStatus,
              createdAt: registration.created_at ?? new Date(0).toISOString(),
            } satisfies Attendee;
          })
          .filter((row): row is Attendee => Boolean(row));

        const rankedRows = [...rows]
          .sort((left, right) => {
            const statusOrder = ATTENDEE_STATUS_ORDER[left.status] - ATTENDEE_STATUS_ORDER[right.status];
            if (statusOrder !== 0) {
              return statusOrder;
            }

            return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
          })
          .map((row) => ({
            ...row,
            topicLabel: getAttendeeRegistrationLabel(row.status),
          }));

        setAttendees(rankedRows);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setAttendees([]);
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadAttendees();

    return () => {
      isActive = false;
    };
  }, []);

  const filteredAttendees = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return attendees;
    }

    return attendees.filter((attendee) => attendee.full_name.toLowerCase().includes(query));
  }, [attendees, searchText]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <header
        className={[
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled ? "bg-[#061B4D]/65 backdrop-blur-xl border-b border-white/10" : "bg-transparent",
        ].join(" ")}
      >
        <div className="section-shell flex h-20 items-center justify-between">
          <Link href="/" className="focus-ring flex items-center gap-3 rounded-full px-3 py-2 text-sm font-semibold tracking-[0.2em] text-white" aria-label="Go to home page">
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

      <main className="relative z-10 pt-28">
        <div className="bg-wave" aria-hidden="true" />
        <section className="section-shell pb-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="glass-card mx-auto max-w-6xl p-6 sm:p-10"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm tracking-[0.2em] text-[#56A6FF]">ATTENDEES LIST</p>
                <h1 className="mt-2 font-(family-name:--font-poppins) text-3xl font-bold text-white sm:text-4xl">รายชื่อผู้เข้าอบรม</h1>
                <p className="mt-3 text-zinc-300">Onsite แสดงเป็น “{ONSITE_ATTENDANCE_LABEL}” ส่วน Waiting และ Record แสดงเป็น “{RESERVE_RECORDING_LABEL}”</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 lg:min-w-[220px]">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Total</p>
                <p className="mt-1 text-2xl font-semibold text-white">{attendees.length.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="w-full">
                <label className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-zinc-200 focus-within:border-[#56A6FF]/50">
                  <Search className="size-5 shrink-0 text-[#56A6FF]" />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-400"
                    placeholder="ค้นหาชื่อ"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-zinc-100 transition hover:border-[#43D5FF]/50 hover:text-[#56A6FF]"
                aria-label="รีเฟรชข้อมูล"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="mt-8">
              {isLoading ? (
                <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                  <div className="flex items-center gap-3 text-zinc-200">
                    <Loader2 className="size-5 animate-spin text-[#56A6FF]" />
                    กำลังโหลดรายชื่อจาก Supabase...
                  </div>
                </div>
              ) : errorMessage ? (
                <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">
                  <p className="font-semibold">เกิดข้อผิดพลาด</p>
                  <p className="mt-2 text-sm leading-relaxed">{errorMessage}</p>
                </div>
              ) : filteredAttendees.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/5 px-6 text-center">
                  {searchText.trim() ? (
                    <>
                      <h2 className="mt-4 text-xl font-semibold text-white">ยังไม่มีข้อมูลที่ตรงกับชื่อที่ค้นหา</h2>
                      <p className="mt-2 max-w-xl text-sm text-zinc-300">ลองเปลี่ยนคำค้น หรือเคลียร์ช่องค้นหาเพื่อดูรายชื่อทั้งหมดในหัวข้อที่เลือก</p>
                    </>
                  ) : (
                    <>
                      <h2 className="mt-4 text-xl font-semibold text-white">ยังไม่มีข้อมูลผู้เข้าอบรมในหัวข้อนี้</h2>
                    </>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/6 shadow-[0_18px_60px_rgba(1,9,34,0.35)]">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-white/8 text-sm text-zinc-300">
                      <tr>
                        <th className="w-16 px-6 py-4 font-semibold">#</th>
                        <th className="px-6 py-4 font-semibold">ชื่อ</th>
                        <th className="px-6 py-4 font-semibold">หัวข้อที่สมัคร</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendees.map((attendee, index) => (
                        <motion.tr
                          key={attendee.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.2) }}
                          className="border-t border-white/10 text-white hover:bg-white/5"
                        >
                          <td className="px-6 py-4 align-top text-zinc-400">{index + 1}</td>
                          <td className="px-6 py-4 align-top font-medium">{attendee.full_name}</td>
                          <td className="px-6 py-4 align-top text-zinc-200">{attendee.topicLabel}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
