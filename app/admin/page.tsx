"use client";

import { motion } from "framer-motion";
import { Loader2, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import {
  formatWorkshopDate,
  isOnsiteStatusWorkshop,
  isRegistrationStatusWorkshop,
  mergeWorkshopCatalog,
  ONSITE_STATUS_WORKSHOP_CODE,
  ONSITE_STATUS_WORKSHOP_NAME,
  ONSITE_STATUS_WORKSHOP_TITLE,
  REGISTRATION_STATUS_WORKSHOP_CODE,
  REGISTRATION_STATUS_WORKSHOP_NAME,
  REGISTRATION_STATUS_WORKSHOP_TITLE,
  type TopicStatus,
  type WorkshopRecord,
} from "@/lib/workshops";

const ADMIN_SESSION_KEY = "library-ai-lab-admin-user";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WorkshopRow = WorkshopRecord & { id: string };

type TopicRegistrantRow = {
  registrationId: string;
  workshopId: string;
  workshopCode: string;
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  role: string;
  status: TopicStatus;
  createdAt: string;
  updatedAt: string;
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
  phone: string;
  organization: string;
  role: string;
  created_at: string;
  updated_at: string;
};

function csvEscapeField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function sanitizeCsvFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "").trim() || "workshop";
}

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
  const [isOnsiteRegistrationOpen, setIsOnsiteRegistrationOpen] = useState<boolean>(true);
  const [registrationStatusWorkshop, setRegistrationStatusWorkshop] = useState<WorkshopRow | null>(null);
  const [onsiteStatusWorkshop, setOnsiteStatusWorkshop] = useState<WorkshopRow | null>(null);
  const [changePasswordUsername, setChangePasswordUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [activeCodes, setActiveCodes] = useState<string[]>([]);
  const [selectedWorkshopCode, setSelectedWorkshopCode] = useState("");
  const [registrants, setRegistrants] = useState<TopicRegistrantRow[]>([]);
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Record<string, TopicStatus>>({});
  const [pendingDeletions, setPendingDeletions] = useState<Record<string, boolean>>({});
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);

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

        const [{ data: initialWorkshopData, error: initialWorkshopError }, registrationData, topicData] = await Promise.all([
          supabase.from("workshops").select("id, code, title, topic_name, event_date, is_active").order("event_date", { ascending: true }),
          fetchAllRows<RegistrationRow>((from, to) =>
            supabase
              .rpc("admin_list_registrations_all")
              .order("created_at", { ascending: true })
              .order("id", { ascending: true })
              .range(from, to),
          ),
          fetchAllRows<RegistrationTopicRow>((from, to) =>
            supabase
              .rpc("admin_list_registration_topics_all")
              .order("registration_id", { ascending: true })
              .order("workshop_id", { ascending: true })
              .range(from, to),
          ),
        ]);

        if (initialWorkshopError) {
          throw initialWorkshopError;
        }

        if (!isActive) {
          return;
        }

        let workshopData = initialWorkshopData ?? [];

        const hasRegistrationStatusRow = workshopData.some((workshop) => isRegistrationStatusWorkshop(workshop));
        const hasOnsiteStatusRow = workshopData.some((workshop) => isOnsiteStatusWorkshop(workshop));
        if (!hasRegistrationStatusRow || !hasOnsiteStatusRow) {
          const statusRows = [];
          if (!hasRegistrationStatusRow) {
            statusRows.push({
              code: REGISTRATION_STATUS_WORKSHOP_CODE,
              title: REGISTRATION_STATUS_WORKSHOP_TITLE,
              topic_name: REGISTRATION_STATUS_WORKSHOP_NAME,
              event_date: "2026-01-01",
              is_active: true,
            });
          }
          if (!hasOnsiteStatusRow) {
            statusRows.push({
              code: ONSITE_STATUS_WORKSHOP_CODE,
              title: ONSITE_STATUS_WORKSHOP_TITLE,
              topic_name: ONSITE_STATUS_WORKSHOP_NAME,
              event_date: "2026-01-01",
              is_active: true,
            });
          }

          const { error: insertStatusError } = await supabase.from("workshops").upsert(statusRows, { onConflict: "code" });

          if (insertStatusError) {
            throw insertStatusError;
          }

          const { data: refreshedWorkshopData, error: refreshedWorkshopError } = await supabase
            .from("workshops")
            .select("id, code, title, topic_name, event_date, is_active")
            .order("event_date", { ascending: true });

          if (refreshedWorkshopError) {
            throw refreshedWorkshopError;
          }

          workshopData = refreshedWorkshopData ?? [];
        }

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

        const registrationStatusRow = workshopRows.find(isRegistrationStatusWorkshop) ?? null;
        const onsiteStatusRow = workshopRows.find(isOnsiteStatusWorkshop) ?? null;
        setRegistrationStatusWorkshop(registrationStatusRow);
        setOnsiteStatusWorkshop(onsiteStatusRow);
        setIsRegistrationOpen(registrationStatusRow ? Boolean(registrationStatusRow.is_active) : true);
        setIsOnsiteRegistrationOpen(onsiteStatusRow ? Boolean(onsiteStatusRow.is_active) : true);

        const displayWorkshops = workshopRows.filter(
          (workshop) => !isRegistrationStatusWorkshop(workshop) && !isOnsiteStatusWorkshop(workshop),
        );
        setWorkshops(displayWorkshops);
        setActiveCodes(displayWorkshops.filter((workshop) => workshop.is_active).map((workshop) => workshop.code));

        setSelectedWorkshopCode((prev) => prev || displayWorkshops[0]?.code || "");

        const registrationById = new Map(registrationData.map((registration) => [registration.id, registration]));
        const workshopById = new Map(workshopRows.map((workshop) => [workshop.id, workshop]));

        const rows = topicData
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
              phone: registration.phone,
              organization: registration.organization,
              role: registration.role,
              status: topicRow.status as TopicStatus,
              createdAt: registration.created_at,
              updatedAt: registration.updated_at,
            };
          })
          .filter((row): row is TopicRegistrantRow => Boolean(row));

        setRegistrants(rows);
        setPendingStatusChanges({});
        setPendingDeletions({});
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
    () =>
      registrants
        .filter((row) => row.workshopCode === selectedWorkshopCode)
        .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
    [registrants, selectedWorkshopCode],
  );

  const registrantsMarkedForDeletion = useMemo(
    () => selectedWorkshopRegistrants.filter((row) => pendingDeletions[row.registrationId]),
    [selectedWorkshopRegistrants, pendingDeletions],
  );

  useEffect(() => {
    setPendingDeletions({});
  }, [selectedWorkshopCode]);

  function handleExportRegistrantsCsv() {
    if (!selectedWorkshop || selectedWorkshopRegistrants.length === 0) {
      return;
    }

    const headers = ["id", "full_name", "email", "phone", "organization", "role", "status", "created_at", "updated_at"];
    const rows = selectedWorkshopRegistrants.map((row) => [
      row.registrationId,
      row.fullName,
      row.email,
      row.phone,
      row.organization,
      row.role,
      row.status,
      row.createdAt,
      row.updatedAt,
    ]);

    const csvContent = [headers, ...rows]
      .map((line) => line.map((value) => csvEscapeField(String(value ?? ""))).join(","))
      .join("\r\n");

    // Prefix with a BOM so Excel renders Thai (UTF-8) text correctly.
    const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeCsvFileName(`${selectedWorkshop.title} ${selectedWorkshop.topic_name}`)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

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

      const nextWorkshops = workshops
        .filter((workshop) => !isRegistrationStatusWorkshop(workshop) && !isOnsiteStatusWorkshop(workshop))
        .map((workshop) => ({
          ...workshop,
          is_active: activeCodes.includes(workshop.code),
        }));

      const { error } = await supabase.rpc("admin_sync_workshops_catalog", {
        catalog: buildWorkshopCatalogPayload(nextWorkshops),
      });

      if (error) {
        throw error;
      }

      setWorkshops((prev) => prev.filter((workshop) => isRegistrationStatusWorkshop(workshop) || nextWorkshops.some((visibleWorkshop) => visibleWorkshop.code === workshop.code)));
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

  function handleRegistrantDeletionToggle(registrationId: string, checked: boolean) {
    setRegistrantsErrorMessage("");
    setRegistrantsInfoMessage("");
    setPendingDeletions((prev) => {
      const next = { ...prev };
      if (checked) {
        next[registrationId] = true;
      } else {
        delete next[registrationId];
      }
      return next;
    });
  }

  async function persistStatusChanges() {
    const entries = Object.entries(pendingStatusChanges);
    if (entries.length === 0) {
      return;
    }

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
  }

  function handleSaveRegistrantStatuses() {
    if (registrantsMarkedForDeletion.length > 0) {
      setIsDeleteConfirmOpen(true);
      return;
    }

    void runSaveRegistrantStatuses();
  }

  async function runSaveRegistrantStatuses() {
    setIsLoading(true);
    setRegistrantsErrorMessage("");
    setRegistrantsInfoMessage("");

    try {
      await persistStatusChanges();
      setRegistrantsInfoMessage("ปรับปรุงข้อมูลผู้เข้าอบรมเรียบร้อยแล้ว");
    } catch (error) {
      setRegistrantsErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  function handleCancelDeleteRegistrants() {
    setIsDeleteConfirmOpen(false);
  }

  async function handleConfirmDeleteRegistrants() {
    const deletionIds = registrantsMarkedForDeletion.map((row) => row.registrationId);
    setIsDeleteConfirmOpen(false);

    if (deletionIds.length === 0) {
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

      const { error: deleteError } = await supabase.rpc("admin_delete_registrations", {
        ids: deletionIds,
      });

      if (deleteError) {
        throw deleteError;
      }

      const deletedIds = new Set(deletionIds);
      setRegistrants((prev) => prev.filter((row) => !deletedIds.has(row.registrationId)));
      setPendingDeletions((prev) => {
        const next = { ...prev };
        deletedIds.forEach((id) => delete next[id]);
        return next;
      });

      const remainingStatusEntries = Object.entries(pendingStatusChanges).filter(
        ([key]) => !deletedIds.has(key.split("::")[0]),
      );

      if (remainingStatusEntries.length > 0) {
        const payload = remainingStatusEntries.map(([key, status]) => {
          const [registrationId, workshopId] = key.split("::");
          return {
            registration_id: registrationId,
            workshop_id: workshopId,
            status,
          };
        });

        const { error: statusError } = await supabase.rpc("admin_update_registration_topic_statuses", {
          updates: payload,
        });

        if (statusError) {
          throw statusError;
        }
      }

      setPendingStatusChanges({});
      setRegistrantsInfoMessage(`ลบผู้สมัคร ${deletionIds.length} รายชื่อ และปรับปรุงข้อมูลเรียบร้อยแล้ว`);
    } catch (error) {
      setRegistrantsErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleRegistrationOpen() {
    const next = !isRegistrationOpen;
    setIsRegistrationOpen(next);

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("ระบบยังไม่พร้อมใช้งาน: ยังไม่ได้ตั้งค่า Supabase Environment Variables");
      }

      const existingStatusWorkshop = registrationStatusWorkshop ?? workshops.find(isRegistrationStatusWorkshop);
      if (existingStatusWorkshop?.id) {
        const { error } = await supabase
          .from("workshops")
          .update({
            code: REGISTRATION_STATUS_WORKSHOP_CODE,
            title: REGISTRATION_STATUS_WORKSHOP_TITLE,
            topic_name: REGISTRATION_STATUS_WORKSHOP_NAME,
            is_active: next,
          })
          .eq("id", existingStatusWorkshop.id);

        if (error) {
          throw error;
        }

        setRegistrationStatusWorkshop({ ...existingStatusWorkshop, is_active: next });
      } else {
        const { data, error } = await supabase.from("workshops").upsert(
          {
            code: REGISTRATION_STATUS_WORKSHOP_CODE,
            title: REGISTRATION_STATUS_WORKSHOP_TITLE,
            topic_name: REGISTRATION_STATUS_WORKSHOP_NAME,
            event_date: "2026-01-01",
            is_active: next,
          },
          { onConflict: "code" },
        ).select("id, code, title, topic_name, event_date, is_active").single();

        if (error) {
          throw error;
        }

        if (data) {
          setRegistrationStatusWorkshop({
            ...data,
            title: data.title ?? REGISTRATION_STATUS_WORKSHOP_TITLE,
            topic_name: data.topic_name ?? REGISTRATION_STATUS_WORKSHOP_NAME,
            event_date: data.event_date ?? "2026-01-01",
            is_active: Boolean(data.is_active),
          });
        }
      }

    } catch (error) {
      setIsRegistrationOpen(!next);
      setGlobalErrorMessage(getErrorMessage(error));
    }
  }

  async function handleToggleOnsiteRegistrationOpen() {
    const next = !isOnsiteRegistrationOpen;
    setIsOnsiteRegistrationOpen(next);

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("ระบบยังไม่พร้อมใช้งาน: ยังไม่ได้ตั้งค่า Supabase Environment Variables");
      }

      const existingStatusWorkshop = onsiteStatusWorkshop ?? workshops.find(isOnsiteStatusWorkshop);
      if (existingStatusWorkshop?.id) {
        const { error } = await supabase
          .from("workshops")
          .update({
            code: ONSITE_STATUS_WORKSHOP_CODE,
            title: ONSITE_STATUS_WORKSHOP_TITLE,
            topic_name: ONSITE_STATUS_WORKSHOP_NAME,
            is_active: next,
          })
          .eq("id", existingStatusWorkshop.id);

        if (error) {
          throw error;
        }

        setOnsiteStatusWorkshop({ ...existingStatusWorkshop, is_active: next });
      } else {
        const { data, error } = await supabase.from("workshops").upsert(
          {
            code: ONSITE_STATUS_WORKSHOP_CODE,
            title: ONSITE_STATUS_WORKSHOP_TITLE,
            topic_name: ONSITE_STATUS_WORKSHOP_NAME,
            event_date: "2026-01-01",
            is_active: next,
          },
          { onConflict: "code" },
        ).select("id, code, title, topic_name, event_date, is_active").single();

        if (error) {
          throw error;
        }

        if (data) {
          setOnsiteStatusWorkshop({
            ...data,
            title: data.title ?? ONSITE_STATUS_WORKSHOP_TITLE,
            topic_name: data.topic_name ?? ONSITE_STATUS_WORKSHOP_NAME,
            event_date: data.event_date ?? "2026-01-01",
            is_active: Boolean(data.is_active),
          });
        }
      }

    } catch (error) {
      setIsOnsiteRegistrationOpen(!next);
      setGlobalErrorMessage(getErrorMessage(error));
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminUser(null);
    setRegistrants([]);
    setPendingStatusChanges({});
    setPendingDeletions({});
    setIsDeleteConfirmOpen(false);
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
                            "focus-ring inline-flex w-28 items-center justify-between rounded-full px-4 py-2 text-sm font-semibold transition",
                            isRegistrationOpen
                              ? "border border-emerald-400/50 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                              : "border border-rose-400/50 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30",
                          ].join(" ")}
                        >
                          <span className={[
                            "relative h-6 w-11 shrink-0 rounded-full border border-current transition-colors",
                            isRegistrationOpen ? "bg-emerald-300/25" : "bg-rose-300/25",
                          ].join(" ")}>
                            <span className={[
                              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left]",
                              isRegistrationOpen ? "left-6" : "left-0.5",
                            ].join(" ")}></span>
                          </span>
                          <span className="w-7 text-right">{isRegistrationOpen ? "ON" : "OFF"}</span>
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
                            "focus-ring inline-flex w-28 items-center justify-between rounded-full px-4 py-2 text-sm font-semibold transition",
                            isOnsiteRegistrationOpen
                              ? "border border-emerald-400/50 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                              : "border border-rose-400/50 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30",
                          ].join(" ")}
                        >
                          <span className={[
                            "relative h-6 w-11 shrink-0 rounded-full border border-current transition-colors",
                            isOnsiteRegistrationOpen ? "bg-emerald-300/25" : "bg-rose-300/25",
                          ].join(" ")}>
                            <span className={[
                              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left]",
                              isOnsiteRegistrationOpen ? "left-6" : "left-0.5",
                            ].join(" ")}></span>
                          </span>
                          <span className="w-7 text-right">{isOnsiteRegistrationOpen ? "ON" : "OFF"}</span>
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
                        <p className="mt-2 text-sm text-zinc-300">Onsite คือผู้มีสิทธิ์เข้าอบรม, Waiting คือรายชื่อสำรอง, และ Record คือผู้รับชมบันทึกย้อนหลัง</p>
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
                    <p className="text-sm text-zinc-300">Onsite คือผู้มีสิทธิ์เข้าอบรม, Waiting คือรายชื่อสำรอง, และ Record คือผู้รับชมบันทึกย้อนหลัง</p>
                    <div className="flex flex-wrap items-end gap-3">
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
                      <button
                        type="button"
                        onClick={handleExportRegistrantsCsv}
                        disabled={selectedWorkshopRegistrants.length === 0}
                        className="focus-ring inline-flex items-center justify-center rounded-full border border-[#43D5FF]/60 bg-[#43D5FF]/15 px-5 py-3 font-semibold text-[#B7ECFF] transition hover:bg-[#43D5FF]/24 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Export CSV
                      </button>
                    </div>
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
                          <th className="px-5 py-4 font-semibold">ลบ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWorkshopRegistrants.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-5 py-8 text-center text-zinc-300">ยังไม่มีผู้สมัครในหัวข้อนี้</td>
                          </tr>
                        ) : (
                          selectedWorkshopRegistrants.map((row) => (
                            <tr
                              key={`${row.registrationId}-${row.workshopId}`}
                              className={["border-t border-white/10 text-white", pendingDeletions[row.registrationId] ? "bg-rose-500/10" : ""].join(" ")}
                            >
                              <td className="px-5 py-4 font-medium">{row.fullName}</td>
                              <td className="px-5 py-4 text-zinc-300">{row.email}</td>
                              <td className="px-5 py-4">
                                <select
                                  value={row.status}
                                  onChange={(event) => handleRegistrantStatusChange(row.registrationId, row.workshopId, event.target.value as TopicStatus)}
                                  disabled={Boolean(pendingDeletions[row.registrationId])}
                                  className="focus-ring rounded-xl border border-white/20 bg-[#0A245D] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <option value="Onsite">Onsite</option>
                                  <option value="Waiting">Waiting</option>
                                  <option value="Record">Record</option>
                                </select>
                              </td>
                              <td className="px-5 py-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={Boolean(pendingDeletions[row.registrationId])}
                                  onChange={(event) => handleRegistrantDeletionToggle(row.registrationId, event.target.checked)}
                                  aria-label={`เลือกลบ ${row.fullName}`}
                                  className="size-5 rounded border-white/30 bg-[#0A245D] accent-rose-500"
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-zinc-300">
                        รายการที่ยังไม่บันทึก: {Object.keys(pendingStatusChanges).length}
                        {registrantsMarkedForDeletion.length > 0 ? ` · เลือกลบ: ${registrantsMarkedForDeletion.length} รายชื่อ` : ""}
                      </p>
                      <button
                        type="button"
                        disabled={isLoading || (Object.keys(pendingStatusChanges).length === 0 && registrantsMarkedForDeletion.length === 0)}
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

                  {isDeleteConfirmOpen ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
                      <div className="w-full max-w-md rounded-3xl border border-rose-400/40 bg-[#0A1B4D] p-6 shadow-2xl">
                        <h3 className="text-xl font-semibold text-white">ยืนยันการลบผู้สมัคร</h3>
                        <p className="mt-3 text-sm text-zinc-200">
                          ต้องการลบผู้สมัครทั้งหมด {registrantsMarkedForDeletion.length} รายชื่อออกจากระบบใช่หรือไม่? การลบจะลบข้อมูลผู้สมัครและสถานะการสมัครทุกหัวข้อของบุคคลนั้นอย่างถาวร
                        </p>
                        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-200">
                          {registrantsMarkedForDeletion.map((row) => (
                            <li key={row.registrationId}>{row.fullName}</li>
                          ))}
                        </ul>
                        <div className="mt-5 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={handleCancelDeleteRegistrants}
                            className="focus-ring rounded-full border border-white/20 bg-white/10 px-5 py-2.5 font-semibold text-zinc-100 transition hover:border-white/40"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleConfirmDeleteRegistrants()}
                            className="focus-ring rounded-full bg-rose-500 px-5 py-2.5 font-semibold text-white transition hover:bg-rose-400"
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </section>
    </main>
  );
}