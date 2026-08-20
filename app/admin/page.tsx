"use client";

import { motion } from "framer-motion";
import { Loader2, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatWorkshopDate, mergeWorkshopCatalog, type TopicStatus, type WorkshopRecord } from "@/lib/workshops";

const ADMIN_SESSION_KEY = "library-ai-lab-admin-user";
const REGISTRATION_OPEN_KEY = "library-ai-lab-registration-open";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WorkshopRow = WorkshopRecord & { id: string };

type TopicRegistrantRow = {
  registrationId: string;
  workshopId: string;
  workshopCode: string;
  fullName: string;
  email: string;
  status: TopicStatus;
};

type RegistrationTopicRow = {
  registration_id: string;
  workshop_id: string;
  status: TopicStatus;
};

type RegistrationRow = {
  id: string;
  full_name: string;
  email: string;
};

type WorkshopCatalogPayload = Pick<WorkshopRecord, "code" | "title" | "topic_name" | "event_date" | "is_active">;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
}

function hasValidWorkshopId(workshop: WorkshopRecord): workshop is WorkshopRow {
  return typeof workshop.id === "string" && UUID_PATTERN.test(workshop.id);
}

function buildWorkshopCatalogPayload(workshops: WorkshopRecord[]): WorkshopCatalogPayload[] {
  return workshops.map(({ code, title, topic_name, event_date, is_active }) => ({
    code,
    title,
    topic_name,
    event_date,
    is_active,
  }));
}

export default function AdminPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adminUser, setAdminUser] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem(ADMIN_SESSION_KEY);
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [globalErrorMessage, setGlobalErrorMessage] = useState("");
  const [globalInfoMessage, setGlobalInfoMessage] = useState("");
  const [activeTopicsErrorMessage, setActiveTopicsErrorMessage] = useState("");
  const [activeTopicsInfoMessage, setActiveTopicsInfoMessage] = useState("");
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");
  const [passwordInfoMessage, setPasswordInfoMessage] = useState("");
  const [registrantsErrorMessage, setRegistrantsErrorMessage] = useState("");
  const [registrantsInfoMessage, setRegistrantsInfoMessage] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isAttendeeManagerExpanded, setIsAttendeeManagerExpanded] = useState(false);
  const [isOnsiteRegistrationOpen, setIsOnsiteRegistrationOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const savedOnsiteRegistrationState = window.localStorage.getItem("library-ai-lab-onsite-registration-open");
    return savedOnsiteRegistrationState === null ? true : savedOnsiteRegistrationState === "true";
  });
  const [changePasswordUsername, setChangePasswordUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [activeCodes, setActiveCodes] = useState<string[]>([]);
  const [selectedWorkshopCode, setSelectedWorkshopCode] = useState("");
  const [registrants, setRegistrants] = useState<TopicRegistrantRow[]>([]);
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Record<string, TopicStatus>>({});
  const [isRegistrationOpen, setIsRegistrationOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const savedRegistrationOpenState = window.localStorage.getItem(REGISTRATION_OPEN_KEY);
    return savedRegistrationOpenState === null ? true : savedRegistrationOpenState === "true";
  });

  useEffect(() => {
    if (!adminUser) {
      return;
    }

    let isActive = true;

    async function loadAdminData() {
      try {
        setIsLoading(true);
        setGlobalErrorMessage("");

        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          throw new Error("ระบบยังไม่พร้อมใช้งาน: ยังไม่ได้ตั้งค่า Supabase Environment Variables");
        }

        const [{ data: initialWorkshopData, error: initialWorkshopError }, { data: registrationData, error: registrationError }, { data: topicData, error: topicError }] =
          await Promise.all([
            supabase.from("workshops").select("id, code, title, topic_name, event_date, is_active").order("event_date", { ascending: true }),
            supabase.rpc("admin_list_registrations_all"),
            supabase.rpc("admin_list_registration_topics_all"),
          ]);

        if (initialWorkshopError) {
          throw initialWorkshopError;
        }

        if (registrationError) {
          throw registrationError;
        }

        if (topicError) {
          throw topicError;
        }

        if (!isActive) {
          return;
        }

        let workshopData = initialWorkshopData ?? [];
        let mergedWorkshops = mergeWorkshopCatalog(workshopData);

        if (mergedWorkshops.some((workshop) => !hasValidWorkshopId(workshop))) {
          const { error: syncError } = await supabase.rpc("admin_sync_workshops_catalog", {
            catalog: buildWorkshopCatalogPayload(mergedWorkshops),
          });

          if (syncError) {
            throw syncError;
          }

          const { data: syncedWorkshopData, error: syncedWorkshopError } = await supabase
            .from("workshops")
            .select("id, code, title, topic_name, event_date, is_active")
            .order("event_date", { ascending: true });

          if (syncedWorkshopError) {
            throw syncedWorkshopError;
          }

          workshopData = syncedWorkshopData ?? [];
          mergedWorkshops = mergeWorkshopCatalog(workshopData);
        }

        const workshopRows = mergedWorkshops.map((workshop) => ({
          ...workshop,
          id: workshopData?.find((row) => row.code === workshop.code)?.id ?? workshop.id ?? workshop.code,
        }));

        setWorkshops(workshopRows);
        setActiveCodes(workshopRows.filter((workshop) => workshop.is_active).map((workshop) => workshop.code));

        setSelectedWorkshopCode((prev) => prev || workshopRows[0]?.code || "");

        const registrationById = new Map(((registrationData ?? []) as RegistrationRow[]).map((registration) => [registration.id, registration]));
        const workshopById = new Map(workshopRows.map((workshop) => [workshop.id, workshop]));

        const rows = ((topicData ?? []) as RegistrationTopicRow[])
          .map((topicRow) => {
            const registration = registrationById.get(topicRow.registration_id);
            const workshop = workshopById.get(topicRow.workshop_id);

            if (!registration || !workshop) {
              return null;
            }

            return {
              registrationId: topicRow.registration_id,
              workshopId: topicRow.workshop_id,
              workshopCode: workshop.code,
              fullName: registration.full_name,
              email: registration.email,
              status: topicRow.status as TopicStatus,
            };
          })
          .filter((row): row is TopicRegistrantRow => Boolean(row));

        setRegistrants(rows);
        setPendingStatusChanges({});
      } catch (error) {
        if (!isActive) {
          return;
        }

        setGlobalErrorMessage(getErrorMessage(error));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadAdminData();

    return () => {
      isActive = false;
    };
  }, [adminUser]);

  const selectedWorkshop = useMemo(
    () => workshops.find((workshop) => workshop.code === selectedWorkshopCode) ?? null,
    [selectedWorkshopCode, workshops],
  );

  const selectedWorkshopRegistrants = useMemo(
    () => registrants.filter((row) => row.workshopCode === selectedWorkshopCode),
    [registrants, selectedWorkshopCode],
  );

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthenticating(true);
    setGlobalErrorMessage("");
    setGlobalInfoMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("ระบบยังไม่พร้อมใช้งาน: ยังไม่ได้ตั้งค่า Supabase Environment Variables");
      }

      const { data, error } = await supabase.rpc("admin_login", {
        input_username: username,
        input_password: password,
      });

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }

      window.localStorage.setItem(ADMIN_SESSION_KEY, username);
      setAdminUser(username);
      setPassword("");
      setGlobalInfoMessage("เข้าสู่ระบบ Admin สำเร็จ");
    } catch (error) {
      setGlobalErrorMessage(getErrorMessage(error));
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthenticating(true);
    setPasswordErrorMessage("");
    setPasswordInfoMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("ระบบยังไม่พร้อมใช้งาน: ยังไม่ได้ตั้งค่า Supabase Environment Variables");
      }

      const { data: isCurrentPasswordValid, error: loginError } = await supabase.rpc("admin_login", {
        input_username: changePasswordUsername,
        input_password: currentPassword,
      });

      if (loginError) {
        throw loginError;
      }

      if (!isCurrentPasswordValid) {
        throw new Error("รหัสผ่านปัจจุบันไม่ถูกต้อง");
      }

      if (!newPassword || !confirmNewPassword) {
        throw new Error("กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่านใหม่");
      }

      if (newPassword !== confirmNewPassword) {
        throw new Error("รหัสผ่านใหม่และยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
      }

      const { data, error } = await supabase.rpc("admin_change_password", {
        input_username: changePasswordUsername,
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาตรวจสอบข้อมูลอีกครั้ง");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowChangePassword(false);
      setPasswordInfoMessage("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
    } catch (error) {
      setPasswordErrorMessage(getErrorMessage(error));
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleSaveActiveTopics() {
    setIsLoading(true);
    setActiveTopicsErrorMessage("");
    setActiveTopicsInfoMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("ระบบยังไม่พร้อมใช้งาน: ยังไม่ได้ตั้งค่า Supabase Environment Variables");
      }

      const nextWorkshops = workshops.map((workshop) => ({
        ...workshop,
        is_active: activeCodes.includes(workshop.code),
      }));

      const { error } = await supabase.rpc("admin_sync_workshops_catalog", {
        catalog: buildWorkshopCatalogPayload(nextWorkshops),
      });

      if (error) {
        throw error;
      }

      setWorkshops(nextWorkshops);
      setActiveTopicsInfoMessage("อัปเดตรายการหัวข้อที่เปิดใช้งานแล้ว");
    } catch (error) {
      setActiveTopicsErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  function handleRegistrantStatusChange(registrationId: string, workshopId: string, status: TopicStatus) {
    const key = `${registrationId}::${workshopId}`;

    setRegistrantsErrorMessage("");
    setRegistrantsInfoMessage("");
    setRegistrants((prev) => prev.map((row) => (row.registrationId === registrationId && row.workshopId === workshopId ? { ...row, status } : row)));
    setPendingStatusChanges((prev) => ({
      ...prev,
      [key]: status,
    }));
  }

  async function handleSaveRegistrantStatuses() {
    const entries = Object.entries(pendingStatusChanges);
    if (entries.length === 0) {
      return;
    }

    setIsLoading(true);
    setRegistrantsErrorMessage("");
    setRegistrantsInfoMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("ระบบยังไม่พร้อมใช้งาน: ยังไม่ได้ตั้งค่า Supabase Environment Variables");
      }

      const payload = entries.map(([key, status]) => {
        const [registrationId, workshopId] = key.split("::");
        return {
          registration_id: registrationId,
          workshop_id: workshopId,
          status,
        };
      });

      const { error } = await supabase.rpc("admin_update_registration_topic_statuses", {
        updates: payload,
      });

      if (error) {
        throw error;
      }

      setPendingStatusChanges({});
      setRegistrantsInfoMessage("ปรับปรุงข้อมูลผู้เข้าอบรมเรียบร้อยแล้ว");
    } catch (error) {
      setRegistrantsErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  function handleToggleRegistrationOpen() {
    setIsRegistrationOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem(REGISTRATION_OPEN_KEY, String(next));
      return next;
    });
  }

  function handleToggleOnsiteRegistrationOpen() {
    setIsOnsiteRegistrationOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem("library-ai-lab-onsite-registration-open", String(next));
      return next;
    });
  }

  function handleLogout() {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminUser(null);
    setRegistrants([]);
    setPendingStatusChanges({});
    setGlobalInfoMessage("");
    setGlobalErrorMessage("");
    setActiveTopicsErrorMessage("");
    setActiveTopicsInfoMessage("");
    setPasswordErrorMessage("");
    setPasswordInfoMessage("");
    setRegistrantsErrorMessage("");
    setRegistrantsInfoMessage("");
  }

  return (
    <main className="relative min-h-screen overflow-hidden py-24 pt-28">
      <div className="bg-wave" aria-hidden="true" />
      <section className="section-shell relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="glass-card mx-auto max-w-6xl p-6 sm:p-10"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm tracking-[0.22em] text-[#FFB84D]">ADMIN CONSOLE</p>
              <h1 className="mt-2 font-(family-name:--font-poppins) text-3xl font-bold text-white sm:text-4xl">จัดการหัวข้ออบรมและสถานะผู้สมัคร</h1>
              <p className="mt-3 max-w-3xl text-zinc-300">เลือกหัวข้อที่เปิดใช้งานสำหรับหน้า Registration, ปรับสถานะผู้สมัครต่อหัวข้อ, และเปลี่ยนรหัสผ่านผู้ดูแลระบบได้จากหน้านี้</p>
            </div>
            <Link href="/" className="focus-ring rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-[#FFB84D]/50 hover:text-[#FFE4B5]">
              กลับหน้าแรก
            </Link>
          </div>

          {!adminUser && globalErrorMessage ? <p className="mt-6 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{globalErrorMessage}</p> : null}
          {!adminUser && globalInfoMessage ? <p className="mt-6 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{globalInfoMessage}</p> : null}
          {adminUser && globalErrorMessage ? <p className="mt-6 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{globalErrorMessage}</p> : null}

          {!adminUser ? (
            <div className="mt-8 mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/6 p-6">
              {!showChangePassword ? (
                <form onSubmit={handleLogin}>
                  <div className="flex items-center gap-3 text-white">
                    <ShieldCheck className="size-6 text-[#FFB84D]" />
                    <h2 className="text-2xl font-semibold">Login as Admin</h2>
                  </div>
                  <div className="mt-6 grid gap-4">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-zinc-100">Username</span>
                      <input value={username} onChange={(event) => setUsername(event.target.value)} className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-zinc-100">Password</span>
                      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white" />
                    </label>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={isAuthenticating} className="focus-ring inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF9A3D] to-[#FFC857] px-6 py-3 font-semibold text-[#351A00] transition hover:scale-105">
                      {isAuthenticating ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordErrorMessage("");
                        setPasswordInfoMessage("");
                        setChangePasswordUsername("");
                        setShowChangePassword(true);
                      }}
                      className="focus-ring rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-[#FFB84D]/55 hover:text-[#FFE4B5]"
                    >
                      เปลี่ยนรหัสผ่าน
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleChangePassword} className="grid gap-4">
                  <div className="flex items-center gap-3 text-white">
                    <LockKeyhole className="size-6 text-[#FFB84D]" />
                    <h2 className="text-2xl font-semibold">เปลี่ยนรหัสผ่าน</h2>
                  </div>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-zinc-100">Username</span>
                    <input value={changePasswordUsername} onChange={(event) => setChangePasswordUsername(event.target.value)} className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-zinc-100">รหัสผ่านปัจจุบัน</span>
                    <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-zinc-100">รหัสผ่านใหม่</span>
                    <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-zinc-100">ยืนยันรหัสผ่านใหม่</span>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(event) => setConfirmNewPassword(event.target.value)}
                      className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white"
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={isAuthenticating} className="focus-ring inline-flex items-center justify-center rounded-full border border-[#FFB84D]/60 bg-[#FFB84D]/18 px-5 py-3 font-semibold text-[#FFE4B5] transition hover:bg-[#FFB84D]/26">
                      {isAuthenticating ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordErrorMessage("");
                        setPasswordInfoMessage("");
                        setShowChangePassword(false);
                      }}
                      className="focus-ring rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-white/35"
                    >
                      กลับไปล็อกอิน
                    </button>
                  </div>
                  <div className="min-h-[56px] space-y-2">
                    {passwordErrorMessage ? <p className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">{passwordErrorMessage}</p> : null}
                    {passwordInfoMessage ? <p className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">{passwordInfoMessage}</p> : null}
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="mt-8">
              {!isAttendeeManagerExpanded ? (
                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-white/10 bg-white/6 p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-2xl font-semibold text-white">Workshop Activation</h2>
                          <p className="mt-2 text-sm text-zinc-300">เลือกได้หลายหัวข้อ หัวข้อที่ active จะไปแสดงในหน้า Registration และถูกเน้นสีในหน้า Home</p>
                        </div>
                        <button type="button" onClick={handleLogout} className="focus-ring inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-rose-300/50 hover:text-rose-100">
                          <LogOut size={16} /> ออกจากระบบ
                        </button>
                      </div>

                      <div className="mt-6 grid gap-3">
                        {workshops.map((workshop) => (
                          <label key={workshop.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <input
                              type="checkbox"
                              checked={activeCodes.includes(workshop.code)}
                              onChange={(event) => {
                                setActiveCodes((prev) =>
                                  event.target.checked ? Array.from(new Set([...prev, workshop.code])) : prev.filter((code) => code !== workshop.code),
                                );
                              }}
                              className="mt-1 h-4 w-4 accent-[#FFB84D]"
                            />
                            <div>
                              <p className="text-sm font-semibold text-[#FFE4B5]">{workshop.title}</p>
                              <p className="text-base text-white">{workshop.topic_name}</p>
                              <p className="mt-1 text-xs text-zinc-400">{formatWorkshopDate(workshop.event_date)}</p>
                            </div>
                          </label>
                        ))}
                      </div>

                      <button type="button" disabled={isLoading} onClick={handleSaveActiveTopics} className="focus-ring mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF9A3D] to-[#FFC857] px-6 py-3 font-semibold text-[#351A00] transition hover:scale-105">
                        {isLoading ? <Loader2 className="size-5 animate-spin" /> : "บันทึกหัวข้อที่เปิดใช้งาน"}
                      </button>
                      <div className="mt-4 min-h-[56px] space-y-2">
                        {activeTopicsErrorMessage ? <p className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">{activeTopicsErrorMessage}</p> : null}
                        {activeTopicsInfoMessage ? <p className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">{activeTopicsInfoMessage}</p> : null}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/6 p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-2xl font-semibold text-white">ตั้งค่าสถานะการเปิดรับสมัคร</h2>
                          <p className="mt-2 text-sm text-zinc-300">สถานะปัจจุบัน: {isRegistrationOpen ? "เปิดรับสมัคร" : "ปิดรับสมัคร"}</p>
                        </div>
                        <button
                          type="button"
                          aria-pressed={isRegistrationOpen}
                          onClick={handleToggleRegistrationOpen}
                          className={[
                            "focus-ring inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm font-semibold transition",
                            isRegistrationOpen
                              ? "border border-emerald-400/50 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                              : "border border-rose-400/50 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30",
                          ].join(" ")}
                        >
                          <span className={[
                            "inline-flex h-5 w-9 items-center rounded-full border border-current p-0.5",
                            isRegistrationOpen ? "justify-end bg-emerald-300/25" : "justify-start bg-rose-300/25",
                          ].join(" ")}>
                            <span className={[
                              "h-3.5 w-3.5 rounded-full bg-white shadow-sm transition",
                              isRegistrationOpen ? "translate-x-0" : "translate-x-0",
                            ].join(" ")}></span>
                          </span>
                          {isRegistrationOpen ? "ON" : "OFF"}
                        </button>
                      </div>
                      <p className="mt-3 text-sm text-zinc-300">
                        {isRegistrationOpen ? "ระบบกำลังเปิดรับสมัครอยู่" : "ระบบปิดรับสมัครชั่วคราว"}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/6 p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-2xl font-semibold text-white">ปิดการรับสมัคร On-site</h2>
                          <p className="mt-2 text-sm text-zinc-300">สถานะปัจจุบัน: {isOnsiteRegistrationOpen ? "เปิดรับสมัคร On-site" : "ปิดรับสมัคร On-site"}</p>
                        </div>
                        <button
                          type="button"
                          aria-pressed={isOnsiteRegistrationOpen}
                          onClick={handleToggleOnsiteRegistrationOpen}
                          className={[
                            "focus-ring inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm font-semibold transition",
                            isOnsiteRegistrationOpen
                              ? "border border-emerald-400/50 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                              : "border border-rose-400/50 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30",
                          ].join(" ")}
                        >
                          <span className={[
                            "inline-flex h-5 w-9 items-center rounded-full border border-current p-0.5",
                            isOnsiteRegistrationOpen ? "justify-end bg-emerald-300/25" : "justify-start bg-rose-300/25",
                          ].join(" ")}>
                            <span className="h-3.5 w-3.5 rounded-full bg-white shadow-sm transition"></span>
                          </span>
                          {isOnsiteRegistrationOpen ? "ON" : "OFF"}
                        </button>
                      </div>
                      <p className="mt-3 text-sm text-zinc-300">
                        {isOnsiteRegistrationOpen ? "ผู้สมัครสามารถเลือกเข้าร่วม On-site ได้" : "ผู้สมัครไม่สามารถเลือกเข้าร่วม On-site ได้ ต้องเลือกรับชมบันทึกย้อนหลัง"}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/6 p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-2xl font-semibold text-white">เปลี่ยนรหัสผ่าน</h2>
                          <p className="mt-2 text-sm text-zinc-300">ปรับรหัสผ่านผู้ดูแลจากฐานข้อมูลโดยตรง</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowChangePassword((prev) => {
                              const next = !prev;
                              if (next) {
                                setChangePasswordUsername(adminUser ?? "");
                              }
                              return next;
                            });
                          }}
                          className="focus-ring rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-[#FFB84D]/55 hover:text-[#FFE4B5]"
                        >
                          {showChangePassword ? "ซ่อนฟอร์ม" : "เปลี่ยนรหัสผ่าน"}
                        </button>
                      </div>
                      {showChangePassword ? (
                        <form onSubmit={handleChangePassword} className="mt-6 grid gap-4">
                          <label className="grid gap-2">
                            <span className="text-sm font-semibold text-zinc-100">Username</span>
                            <input value={changePasswordUsername} onChange={(event) => setChangePasswordUsername(event.target.value)} className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white" />
                          </label>
                          <label className="grid gap-2">
                            <span className="text-sm font-semibold text-zinc-100">รหัสผ่านปัจจุบัน</span>
                            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white" />
                          </label>
                          <label className="grid gap-2">
                            <span className="text-sm font-semibold text-zinc-100">รหัสผ่านใหม่</span>
                            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white" />
                          </label>
                          <label className="grid gap-2">
                            <span className="text-sm font-semibold text-zinc-100">ยืนยันรหัสผ่านใหม่</span>
                            <input
                              type="password"
                              value={confirmNewPassword}
                              onChange={(event) => setConfirmNewPassword(event.target.value)}
                              className="focus-ring rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white"
                            />
                          </label>
                          <button type="submit" disabled={isAuthenticating} className="focus-ring inline-flex items-center justify-center rounded-full border border-[#FFB84D]/60 bg-[#FFB84D]/18 px-5 py-3 font-semibold text-[#FFE4B5] transition hover:bg-[#FFB84D]/26">
                            {isAuthenticating ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
                          </button>
                          <div className="min-h-[56px] space-y-2">
                            {passwordErrorMessage ? <p className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">{passwordErrorMessage}</p> : null}
                            {passwordInfoMessage ? <p className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">{passwordInfoMessage}</p> : null}
                          </div>
                        </form>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/6 p-6">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-semibold text-white">จัดการสถานะผู้สมัครต่อหัวข้อ</h2>
                        <p className="mt-2 text-sm text-zinc-300">สถานะ `Waiting` จะถูกใช้เป็นรายชื่อสำรอง และ `skip` จะไม่ถูกแสดงในหน้า attendees</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAttendeeManagerExpanded(true)}
                        className="focus-ring inline-flex items-center justify-center rounded-full border border-[#FFB84D]/60 bg-[#FFB84D]/18 px-5 py-3 font-semibold text-[#FFE4B5] transition hover:bg-[#FFB84D]/26"
                      >
                        Manage attendees
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/6 p-6">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setIsAttendeeManagerExpanded(false)}
                      className="focus-ring inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-[#FFB84D]/55 hover:text-[#FFE4B5]"
                    >
                      ย้อนกลับ
                    </button>
                    <div>
                      <h2 className="text-2xl font-semibold text-white">จัดการสถานะผู้สมัครต่อหัวข้อ</h2>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <p className="text-sm text-zinc-300">สถานะ `Waiting` จะถูกใช้เป็นรายชื่อสำรอง และ `skip` จะไม่ถูกแสดงในหน้า attendees</p>
                    <label className="grid gap-2 text-sm text-zinc-200">
                      <span>เลือกหัวข้อ</span>
                      <select value={selectedWorkshopCode} onChange={(event) => setSelectedWorkshopCode(event.target.value)} className="focus-ring rounded-xl border border-white/20 bg-[#0A245D] px-4 py-3 text-white">
                        {workshops.map((workshop) => (
                          <option key={workshop.id} value={workshop.code}>
                            {workshop.title} - {workshop.topic_name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {selectedWorkshop ? (
                    <p className="mt-4 text-sm text-[#FFE4B5]">หัวข้อที่เลือก: {selectedWorkshop.title} - {selectedWorkshop.topic_name}</p>
                  ) : null}

                  <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                    <table className="w-full border-collapse text-left">
                      <thead className="bg-white/8 text-sm text-zinc-300">
                        <tr>
                          <th className="px-5 py-4 font-semibold">ชื่อผู้สมัคร</th>
                          <th className="px-5 py-4 font-semibold">อีเมล</th>
                          <th className="px-5 py-4 font-semibold">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWorkshopRegistrants.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-5 py-8 text-center text-zinc-300">ยังไม่มีผู้สมัครในหัวข้อนี้</td>
                          </tr>
                        ) : (
                          selectedWorkshopRegistrants.map((row) => (
                            <tr key={`${row.registrationId}-${row.workshopId}`} className="border-t border-white/10 text-white">
                              <td className="px-5 py-4 font-medium">{row.fullName}</td>
                              <td className="px-5 py-4 text-zinc-300">{row.email}</td>
                              <td className="px-5 py-4">
                                <select
                                  value={row.status}
                                  onChange={(event) => handleRegistrantStatusChange(row.registrationId, row.workshopId, event.target.value as TopicStatus)}
                                  className="focus-ring rounded-xl border border-white/20 bg-[#0A245D] px-4 py-2 text-white"
                                >
                                  <option value="Participant">Participant</option>
                                  <option value="Waiting">Waiting</option>
                                  <option value="skip">skip</option>
                                </select>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-zinc-300">รายการที่ยังไม่บันทึก: {Object.keys(pendingStatusChanges).length}</p>
                      <button
                        type="button"
                        disabled={isLoading || Object.keys(pendingStatusChanges).length === 0}
                        onClick={handleSaveRegistrantStatuses}
                        className="focus-ring inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF9A3D] to-[#FFC857] px-6 py-3 font-semibold text-[#351A00] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 className="size-5 animate-spin" /> : "บันทึก"}
                      </button>
                    </div>
                    <div className="min-h-[56px] space-y-2">
                      {registrantsErrorMessage ? <p className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">{registrantsErrorMessage}</p> : null}
                      {registrantsInfoMessage ? <p className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">{registrantsInfoMessage}</p> : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </section>
    </main>
  );
}