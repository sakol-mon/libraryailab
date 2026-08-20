export type TopicStatus = "Onsite" | "Waiting" | "Record";

export type WorkshopRecord = {
  id?: string;
  code: string;
  title: string;
  topic_name: string;
  event_date: string;
  is_active: boolean;
};

export const REGISTRATION_STATUS_WORKSHOP_CODE = "register-status";
export const REGISTRATION_STATUS_WORKSHOP_TITLE = "ครั้งที่ 0";
export const REGISTRATION_STATUS_WORKSHOP_NAME = "Register status";

export const ONSITE_STATUS_WORKSHOP_CODE = "onsite-status";
export const ONSITE_STATUS_WORKSHOP_TITLE = "ครั้งที่ 0.1";
export const ONSITE_STATUS_WORKSHOP_NAME = "Onsite status";

export function isRegistrationStatusWorkshop(workshop: Partial<WorkshopRecord> | null | undefined): boolean {
  if (!workshop) {
    return false;
  }

  return (
    workshop.code === REGISTRATION_STATUS_WORKSHOP_CODE ||
    workshop.title === REGISTRATION_STATUS_WORKSHOP_TITLE ||
    workshop.topic_name === REGISTRATION_STATUS_WORKSHOP_NAME
  );
}

export function isOnsiteStatusWorkshop(workshop: Partial<WorkshopRecord> | null | undefined): boolean {
  if (!workshop) {
    return false;
  }

  return (
    workshop.code === ONSITE_STATUS_WORKSHOP_CODE ||
    workshop.title === ONSITE_STATUS_WORKSHOP_TITLE ||
    workshop.topic_name === ONSITE_STATUS_WORKSHOP_NAME
  );
}

export const DEFAULT_WORKSHOPS: WorkshopRecord[] = [
  { code: "NotebookLM", title: "ครั้งที่ 1", topic_name: "NotebookLM", event_date: "2026-08-19", is_active: true },
  { code: "Claude", title: "ครั้งที่ 2", topic_name: "Claude", event_date: "2026-09-02", is_active: true },
  { code: "Gemini", title: "ครั้งที่ 3", topic_name: "Gemini", event_date: "2026-09-16", is_active: true },
  { code: "AI for Research", title: "ครั้งที่ 4", topic_name: "Prism", event_date: "2026-09-30", is_active: true },
  { code: "Antigravity 2.0", title: "ครั้งที่ 5", topic_name: "Antigravity 2.0", event_date: "2026-10-14", is_active: true },
  { code: "n8n", title: "ครั้งที่ 6", topic_name: "n8n", event_date: "2026-10-28", is_active: true },
  { code: "Scopus AI", title: "ครั้งที่ 7", topic_name: "Scopus AI & Consensus & Elicit", event_date: "2026-11-11", is_active: true },
  { code: "Data Analysis", title: "ครั้งที่ 8", topic_name: "Data Analysis with AI", event_date: "2026-11-25", is_active: true },
  {
    code: REGISTRATION_STATUS_WORKSHOP_CODE,
    title: REGISTRATION_STATUS_WORKSHOP_TITLE,
    topic_name: REGISTRATION_STATUS_WORKSHOP_NAME,
    event_date: "2026-01-01",
    is_active: true,
  },
  {
    code: ONSITE_STATUS_WORKSHOP_CODE,
    title: ONSITE_STATUS_WORKSHOP_TITLE,
    topic_name: ONSITE_STATUS_WORKSHOP_NAME,
    event_date: "2026-01-01",
    is_active: true,
  },
];

const thaiMonths = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export function formatTopicLabel(topicName: string): string {
  if (topicName.includes("AI for Research")) {
    return "Prism";
  }

  if (topicName === "Data Analysis") {
    return "Data Analysis with AI";
  }

  if (topicName === "Scopus AI") {
    return "Scopus AI & Consensus & Elicit";
  }

  return topicName;
}

export function getTopicSortKey(topicName: string): string {
  if (topicName === "Scopus AI & Consensus & Elicit") {
    return "Scopus AI";
  }

  if (topicName === "Data Analysis with AI") {
    return "Data Analysis";
  }

  return topicName;
}

export function formatWorkshopDate(eventDate: string): string {
  const parsed = new Date(`${eventDate}T09:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) {
    return eventDate;
  }

  const day = parsed.getUTCDate();
  const month = thaiMonths[parsed.getUTCMonth()] ?? "";
  const buddhistYear = parsed.getUTCFullYear() + 543;
  return `${day} ${month} พ.ศ. ${buddhistYear}`;
}

export function mergeWorkshopCatalog(workshops: Partial<WorkshopRecord>[] | null | undefined): WorkshopRecord[] {
  const workshopByCode = new Map(
    (workshops ?? [])
      .filter((workshop): workshop is Partial<WorkshopRecord> & { code: string } => Boolean(workshop?.code))
      .map((workshop) => [workshop.code, workshop]),
  );

  return DEFAULT_WORKSHOPS.map((fallback) => {
    const override = workshopByCode.get(fallback.code);
    return {
      ...fallback,
      ...override,
      code: fallback.code,
      // Keep canonical titles from source to avoid rendering corrupted DB text.
      title: fallback.title,
      topic_name: override?.topic_name ?? fallback.topic_name,
      event_date: override?.event_date ?? fallback.event_date,
      is_active: override?.is_active ?? fallback.is_active,
    };
  });
}