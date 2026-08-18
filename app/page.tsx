"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  Clock3,
  Cpu,
  GraduationCap,
  Globe2,
  Handshake,
  Mail,
  MapPin,
  Menu,
  Phone,
  Printer,
  ScanLine,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import speakerImage1 from "@/image/1.png";
import speakerImage2 from "@/image/2.png";
import speakerImage3 from "@/image/3.png";
import speakerImage4 from "@/image/4.png";
import logoImage from "@/image/logo.png";
import posterImage from "@/image/poster.png";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatWorkshopDate, mergeWorkshopCatalog, type WorkshopRecord } from "@/lib/workshops";

const navLinks = ["Home", "About", "Speakers", "Schedule", "Registration", "รายชื่อผู้เข้าอบรม", "Contact"];

function navHref(item: string): string {
  if (item === "Registration") {
    return "/registration";
  }

  if (item === "รายชื่อผู้เข้าอบรม") {
    return "/attendees";
  }

  return `#${item.toLowerCase()}`;
}

const speakers = [
  {
    image: speakerImage1,
    name: "ผศ. ดร.เจษฎา อานิล",
    position: "ผู้ช่วยอธิการบดีฝ่ายการศึกษา และอาจารย์ประจำภาควิชาวิศวกรรมชีวการแพทย์์ คณะวิศวกรรมศาสตร์ มหาวิทยาลัยมหิดล",
    topic: "NotebookLM",
    date: "19 สิงหาคม 2569",
  },
  {
    image: speakerImage2,
    name: "ผศ. ดร.ฐิติพัทธ์ อัชชะกุลวิสุทธิ์",
    position: "อาจารย์ประจำภาควิชาวิศวกรรมชีวการแพทย์ คณะวิศวกรรมศาสตร์ มหาวิทยาลัยมหิดล",
    topic: "Claude",
    date: "2 กันยายน 2569",
  },
  {
    image: speakerImage3,
    name: "ว่าที่ ร.ต.ธีรพัฒน์ กันสดับ",
    position: "นักวิชาการคอมพิวเตอร์ หน่วยพัฒนาปัญญาประดิษฐ์",
    topic: "Gemini",
    date: "16 กันยายน 2569",
  },
  {
    image: speakerImage4,
    name: "ผศ. ดร.ทวีศักดิ์ สมานชื่น",
    position: "รองผู้อำนวยการฝ่ายเทคโนโลยีดิจิทัล หอสมุดและคลังความรู้มหาวิทยาลัยมหิดล",
    topic: "Prism",
    date: "30 กันยายน 2569",
  },
];

const faq = [
  {
    question: "ใครสามารถเข้าร่วมได้บ้าง?",
    answer: "นักศึกษา บุคลากร นักวิจัยของมหาวิทยาลัยมหิดล และเครือข่ายพันธมิตรทางวิชาการที่ได้รับเชิญซึ่งสนใจพัฒนาทักษะ AI เชิงปฏิบัติสามารถเข้าร่วมได้",
  },
  {
    question: "เข้าร่วมฟรีหรือไม่?",
    answer: "เข้าร่วมได้ฟรี โดยโครงการ LIBRARY AI LAB ได้รับการสนับสนุนจากหอสมุดและคลังความรู้มหาวิทยาลัยมหิดล",
  },
  {
    question: "มีใบประกาศนียบัตรให้หรือไม่?",
    answer: "ผู้เข้าร่วมที่มีคุณสมบัติตามเกณฑ์การเข้าร่วมและทำกิจกรรมภายในเวิร์กชอปครบถ้วน จะได้รับใบประกาศนียบัตรในรูปแบบดิจิทัล",
  },
  {
    question: "ต้องเตรียมอะไรมาบ้าง?",
    answer: "ควรเตรียมอีเมลสำหรับการลงทะเบียนใช้งาน AI มาก่อน และเพื่อความพร้อมในการทดลองใช้เครื่องมือ AI กับกรณีศึกษาจริงทางวิชาการ",
  },
  {
    question: "จำเป็นต้องมีพื้นฐานด้าน AI มาก่อนหรือไม่?",
    answer: "ไม่จำเป็นต้องมีประสบการณ์ด้าน AI มาก่อน โดยเวิร์กชอปนี้ออกแบบให้เหมาะสำหรับผู้เริ่มต้นจนถึงผู้ที่มีพื้นฐานระดับปานกลาง",
  },
];

const particles = [
  { left: "4%", top: "18%", size: 5, delay: 0 },
  { left: "15%", top: "68%", size: 3, delay: 1 },
  { left: "31%", top: "28%", size: 4, delay: 2.3 },
  { left: "43%", top: "80%", size: 5, delay: 1.2 },
  { left: "56%", top: "33%", size: 4, delay: 0.5 },
  { left: "68%", top: "12%", size: 3, delay: 2 },
  { left: "79%", top: "76%", size: 4, delay: 1.8 },
  { left: "88%", top: "39%", size: 5, delay: 2.5 },
  { left: "93%", top: "61%", size: 3, delay: 0.8 },
  { left: "23%", top: "49%", size: 4, delay: 3 },
];

type CountdownState = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

// Thai month mapping
const thaiMonths: { [key: string]: number } = {
  มกราคม: 0, กุมภาพันธ์: 1, มีนาคม: 2, เมษายน: 3,
  พฤษภาคม: 4, มิถุนายน: 5, กรฎฐาคม: 6, สิงหาคม: 7,
  กันยายน: 8, ตุลาคม: 9, พฤศจิกายน: 10, ธันวาคม: 11,
};

function parseWorkshopDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-").map((value) => parseInt(value, 10));
    return new Date(year, month - 1, day, 9, 0, 0);
  }

  const parts = dateStr.split(" ");
  const day = parseInt(parts[0], 10);
  const month = thaiMonths[parts[1]];
  const buddhYear = parseInt(parts[3], 10);
  const gregorianYear = buddhYear - 543;

  return new Date(gregorianYear, month, day, 9, 0, 0);
}

const DEFAULT_TIMELINE_REFERENCE_DATE = new Date("2026-08-18T00:00:00+07:00");

// Get timeline item state based on current date (Bangkok timezone)
function getTimelineItemState(dateStr: string, now: Date): "completed" | "current" | "upcoming" {
  // Get current time in Bangkok timezone (UTC+7)
  const bangkokTime = new Date(now.getTime() + (7 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));

  const itemDate = parseWorkshopDate(dateStr);

  // Start of the day for comparison
  const startOfDay = new Date(itemDate);
  startOfDay.setHours(0, 0, 0, 0);

  // End of the day for comparison
  const endOfDay = new Date(itemDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Get current time without timezone offset
  const currentDay = new Date(bangkokTime);
  currentDay.setHours(bangkokTime.getHours(), bangkokTime.getMinutes(), bangkokTime.getSeconds(), bangkokTime.getMilliseconds());

  // Reset to start of current day for comparison
  const currentStartOfDay = new Date(currentDay);
  currentStartOfDay.setHours(0, 0, 0, 0);

  if (currentStartOfDay > endOfDay) {
    return "completed";
  } else if (currentStartOfDay.getTime() === startOfDay.getTime()) {
    return "current";
  } else {
    return "upcoming";
  }
}

const targetDate = new Date("2026-08-19T09:00:00+07:00");
function formatCountdown(now: number): CountdownState {
  const distance = targetDate.getTime() - now;
  if (distance <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  return {
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((distance / (1000 * 60)) % 60),
    seconds: Math.floor((distance / 1000) % 60),
    expired: false,
  };
}

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [countdown, setCountdown] = useState<CountdownState>({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });
  const [countdownLoaded, setCountdownLoaded] = useState(false);
  const [timelineReferenceDate] = useState<Date>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_TIMELINE_REFERENCE_DATE;
    }

    return new Date();
  });
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [posterOpen, setPosterOpen] = useState(false);
  const [posterZoom, setPosterZoom] = useState(1);
  const [workshops, setWorkshops] = useState<WorkshopRecord[]>(mergeWorkshopCatalog(undefined));
  const posterViewportRef = useRef<HTMLDivElement | null>(null);
  const pendingPosterFocusRef = useRef<{ x: number; y: number } | null>(null);
  const pendingPosterRestoreRef = useRef(false);
  const posterPreZoomScrollRef = useRef<{ left: number; top: number } | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const initializeId = window.setTimeout(() => {
      setCountdown(formatCountdown(Date.now()));
      setCountdownLoaded(true);
    }, 0);

    const id = window.setInterval(() => {
      setCountdown(formatCountdown(Date.now()));
    }, 1000);

    return () => {
      window.clearTimeout(initializeId);
      window.clearInterval(id);
    };
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

        setWorkshops(mergeWorkshopCatalog(data));
      } catch {
        // Keep fallback workshop catalog if DB is not reachable.
      }
    }

    void loadWorkshops();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!posterOpen) {
      const resetId = window.setTimeout(() => {
        setPosterZoom(1);
        pendingPosterFocusRef.current = null;
        pendingPosterRestoreRef.current = false;
        posterPreZoomScrollRef.current = null;
      }, 0);

      return () => window.clearTimeout(resetId);
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPosterOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (posterViewportRef.current) {
      posterViewportRef.current.scrollTo({ top: 0, left: 0 });
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [posterOpen]);

  useEffect(() => {
    if (!posterOpen || posterZoom !== 2) {
      return;
    }

    const viewport = posterViewportRef.current;
    const focus = pendingPosterFocusRef.current;
    if (!viewport || !focus) {
      return;
    }

    requestAnimationFrame(() => {
      const targetLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, focus.x * viewport.scrollWidth - viewport.clientWidth / 2));
      const targetTop = Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, focus.y * viewport.scrollHeight - viewport.clientHeight / 2));
      viewport.scrollTo({ left: targetLeft, top: targetTop });
      pendingPosterFocusRef.current = null;
    });
  }, [posterOpen, posterZoom]);

  useEffect(() => {
    if (!posterOpen || posterZoom !== 1 || !pendingPosterRestoreRef.current) {
      return;
    }

    const viewport = posterViewportRef.current;
    const previous = posterPreZoomScrollRef.current;
    pendingPosterRestoreRef.current = false;
    if (!viewport || !previous) {
      return;
    }

    requestAnimationFrame(() => {
      const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      viewport.scrollTo({
        left: Math.min(previous.left, maxLeft),
        top: Math.min(previous.top, maxTop),
        behavior: "smooth",
      });
    });
  }, [posterOpen, posterZoom]);

  const handlePosterViewportClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const viewport = posterViewportRef.current;
    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const clickX = event.clientX - rect.left + viewport.scrollLeft;
    const clickY = event.clientY - rect.top + viewport.scrollTop;
    const clickRatioX = viewport.scrollWidth > 0 ? clickX / viewport.scrollWidth : 0.5;
    const clickRatioY = viewport.scrollHeight > 0 ? clickY / viewport.scrollHeight : 0.5;
    const nextZoom = posterZoom === 1 ? 2 : 1;

    if (nextZoom > posterZoom) {
      posterPreZoomScrollRef.current = {
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      };
      pendingPosterFocusRef.current = { x: clickRatioX, y: clickRatioY };
      setPosterZoom(nextZoom);
      return;
    }

    pendingPosterRestoreRef.current = true;
    setPosterZoom(nextZoom);
  };

  const timeline = useMemo(
    () =>
      workshops.map((workshop) => ({
        title: workshop.title,
        topic: workshop.topic_name,
        date: formatWorkshopDate(workshop.event_date),
        eventDate: workshop.event_date,
        isActive: workshop.is_active,
      })),
    [workshops],
  );

  const effectiveTimelineReferenceDate = timelineReferenceDate ?? DEFAULT_TIMELINE_REFERENCE_DATE;

  const eventCards = useMemo(
    () => [
      { icon: Clock3, title: "Time", value: "13:00–16:00" },
      { icon: MapPin, title: "Location", value: "Computer Training Room 2, Mahidol University Library and Knowledge Center, Salaya Campus" },
      { icon: CalendarDays, title: "Format", value: "Workshop" },
    ],
    [],
  );

  const benefits = useMemo(
    () => [
      { icon: GraduationCap, label: "Certificate" },
      { icon: Clock3, label: "Digital Literacy Hours" },
      { icon: BrainCircuit, label: "Hands-on Workshop" },
      { icon: Cpu, label: "AI Tools" },
      { icon: ScanLine, label: "Learning Materials" },
      { icon: Handshake, label: "Networking" },
    ],
    [],
  );

  return (
    <div className="relative">
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled ? "bg-[#061B4D]/65 backdrop-blur-xl border-b border-white/10" : "bg-transparent",
        )}
      >
        <div className="section-shell flex h-20 items-center justify-between gap-3">
          <a href="#home" className="focus-ring flex items-center gap-3 rounded-full px-2 py-2 text-sm font-semibold tracking-[0.2em] text-white" aria-label="Go to home section">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl sm:h-40 sm:w-40">
              <Image
                src={logoImage}
                alt="LIBRARY AI LAB logo"
                width={220}
                height={220}
                sizes="(max-width: 640px) 128px, 160px"
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <span className="hidden sm:inline">LIBRARY AI LAB</span>
          </a>
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

      <main className="relative overflow-hidden" id="home">
        <section
          className="relative flex min-h-screen items-center pt-28"
          onMouseMove={(event) => {
            const x = (event.clientX / window.innerWidth - 0.5) * 14;
            const y = (event.clientY / window.innerHeight - 0.5) * 14;
            setParallax({ x, y });
          }}
        >
          <div className="bg-wave" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {particles.map((particle) => (
              <span
                key={`${particle.left}-${particle.top}`}
                className="absolute rounded-full bg-cyan-200/70"
                style={{
                  left: particle.left,
                  top: particle.top,
                  width: particle.size,
                  height: particle.size,
                  animation: `float 5.2s ease-in-out ${particle.delay}s infinite`,
                  boxShadow: "0 0 16px rgba(103,232,249,0.75)",
                }}
              />
            ))}
          </div>

          <div className="section-shell relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mx-auto max-w-5xl"
            >
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#43D5FF]/40 bg-[#43D5FF]/10 px-4 py-1.5 text-sm text-[#D4E6FF]">
                <Sparkles size={16} />
                Academic Innovation Program
              </div>
              <div
                className="pointer-events-none absolute left-1/2 top-12 h-44 w-44 -translate-x-1/2 rounded-full bg-[#2F7CFF]/20 blur-3xl"
                style={{ transform: `translate(calc(-50% + ${parallax.x}px), ${parallax.y}px)` }}
              />
              <h1 className="relative z-10 font-(family-name:--font-poppins) text-[3.75rem] font-extrabold leading-[0.95] tracking-[-0.02em] text-white sm:text-[4.6875rem] lg:text-[5.625rem]">
                LIBRARY <span className="ai-text">AI</span> LAB
              </h1>
              <p className="mx-auto mt-7 max-w-3xl text-lg leading-relaxed text-zinc-200 sm:text-xl">
                ยกระดับทักษะ AI เพื่ออนาคต
                <br className="hidden sm:block" />
                Empowering Future Skills with Artificial Intelligence
              </p>
              <div className="mt-11 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/registration"
                  className="focus-ring group inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#2F7CFF] to-[#43D5FF] px-9 py-4 text-base font-semibold text-white shadow-[0_0_30px_rgba(67,213,255,0.5)] transition duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(67,213,255,0.65)]"
                >
                  Register Now
                  <ChevronRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="#schedule"
                  className="focus-ring inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-9 py-4 text-base font-semibold text-zinc-100 backdrop-blur-xl transition hover:scale-105 hover:border-[#43D5FF]/60 hover:text-[#56A6FF]"
                >
                  View Schedule
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="about" className="py-24">
          <div className="section-shell grid gap-10 lg:grid-cols-2 lg:items-center">
            <motion.article
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6 }}
            >
              <p className="mb-4 text-sm tracking-[0.18em] text-[#56A6FF]">ABOUT THE WORKSHOP</p>
              <h2 className="font-(family-name:--font-poppins) text-4xl font-bold text-white sm:text-[42px]">ประสบการณ์การเรียนรู้ด้าน AI เชิงวิชาการ</h2>
              <p className="mt-5 text-lg leading-relaxed text-zinc-200">
                LIBRARY AI LAB คือโครงการที่ริเริ่มขึ้นเพื่อยกระดับทักษะด้าน AI สำหรับอนาคต ในยุคที่เทคโนโลยี Generative AI กำลังปรับเปลี่ยนโฉมหน้าของการทำงาน การเรียนรู้ และการวิจัยอย่างไม่เคยเกิดขึ้นมาก่อน หอสมุดและคลังความรู้มหาวิทยาลัยมหิดล ในฐานะศูนย์กลางองค์ความรู้และหน่วยงานสนับสนุนวิชาการของมหาวิทยาลัย จึงมุ่งมั่นเสริมสร้าง AI Literacy ให้เป็นสมรรถนะหลักของบุคลากร นักศึกษา และชุมชนโดยรอบ เพื่อให้ทุกคนสามารถรับมือและปรับตัวต่อการเปลี่ยนแปลงทางเทคโนโลยีได้อย่างมั่นใจ
              </p>
              <p className="mt-5 text-base leading-relaxed text-zinc-300">
                โครงการนี้เน้นการเรียนรู้ผ่านการฝึกปฏิบัติจริงกับเครื่องมือ AI เฉพาะทาง ครอบคลุมทั้งด้านการบริหารจัดการงาน การจัดการเรียนการสอน การวิจัย และการสร้างสรรค์นวัตกรรม เพื่อให้ผู้เข้าร่วมสามารถนำทักษะไปใช้ได้จริงในบริบทการทำงานของตนเอง อันจะนำไปสู่การยกระดับขีดความสามารถในการแข่งขันในยุคดิจิทัล และส่งเสริมวัฒนธรรมการเรียนรู้ตลอดชีวิตที่เข้าถึงได้และยั่งยืนสำหรับทุกคน
              </p>
            </motion.article>

            <motion.div
              initial={{ opacity: 0, x: 28 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.7 }}
              className="glass-card relative p-6 sm:p-8"
              aria-label="Workshop poster"
            >
              <div className="absolute inset-0 rounded-[24px] bg-gradient-to-br from-[#43D5FF]/10 to-[#2F7CFF]/12" />
              <button
                type="button"
                className="focus-ring group relative z-10 mx-auto block w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/10 text-left"
                onClick={() => setPosterOpen(true)}
                aria-label="Open poster preview"
              >
                <Image
                  src={posterImage}
                  alt="LIBRARY AI LAB workshop poster"
                  width={posterImage.width}
                  height={posterImage.height}
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="h-auto w-full object-contain transition duration-200 group-hover:scale-[1.01]"
                />
                <span className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/45 px-3 py-1 text-xs text-white/90 backdrop-blur">
                  Click to expand
                </span>
              </button>
            </motion.div>
          </div>
        </section>

        <section id="speakers" className="py-20">
          <div className="section-shell">
            <h2 className="font-(family-name:--font-poppins) text-center text-4xl font-bold text-white sm:text-[42px]">Featured Speakers</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {speakers.map((speaker, index) => (
                <motion.article
                  key={speaker.name}
                  className="glass-card flex h-full flex-col p-6"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ delay: index * 0.07, duration: 0.5 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                >
                  <div className="mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-full border border-[#43D5FF]/40 shadow-[0_0_36px_rgba(67,213,255,0.5)] sm:max-w-[240px] lg:max-w-[280px]">
                    <Image
                      src={speaker.image}
                      alt={speaker.name}
                      width={600}
                      height={600}
                      sizes="(max-width: 640px) 72vw, (max-width: 1024px) 40vw, 20vw"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <h3 className="mt-5 min-h-[3.5rem] text-center text-xl font-semibold text-white">{speaker.name}</h3>
                  <p className="mt-2 min-h-[7rem] text-center text-sm leading-relaxed text-zinc-300">{speaker.position}</p>
                  <div className="mt-3 rounded-2xl border border-[#43D5FF]/20 bg-[#43D5FF]/8 px-4 py-3 text-sm text-[#D4E6FF]">
                    <p>Topic: {speaker.topic}</p>
                    <p className="mt-1 text-zinc-300">Date: {speaker.date}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="schedule" className="py-20">
          <div className="section-shell">
            <h2 className="font-(family-name:--font-poppins) text-center text-4xl font-bold text-white sm:text-[42px]">Program Timeline</h2>
            <div className="mt-12 hidden xl:block">
              <div className="relative">
                <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-gradient-to-r from-[#2F7CFF]/80 via-[#43D5FF] to-[#56A6FF]/80" />
                <div className="grid grid-cols-8 gap-4">
                  {timeline.map((item) => {
                    const state = getTimelineItemState(item.eventDate, effectiveTimelineReferenceDate);
                    const tone =
                      state === "completed"
                        ? "border-[#00D27A]/70 bg-[#00D27A]/12 text-[#00D27A]"
                        : state === "current"
                          ? "border-[#43D5FF]/70 bg-[#43D5FF]/12 text-[#D4E6FF] shadow-[0_0_35px_rgba(67,213,255,0.5)]"
                          : item.isActive
                            ? "border-[#FFB84D]/65 bg-[#FFB84D]/12 text-[#FFE4B5] shadow-[0_0_30px_rgba(255,184,77,0.25)]"
                            : "border-[#2F7CFF]/50 bg-[#2F7CFF]/10 text-zinc-100";

                    return (
                      <div key={item.title} className="relative z-10 text-center">
                        <div className={cn("mx-auto mb-5 flex h-4 w-4 rounded-full", state === "completed" ? "bg-[#00D27A]" : state === "current" ? "bg-[#43D5FF] shadow-[0_0_18px_rgba(67,213,255,0.9)]" : item.isActive ? "bg-[#FFB84D] shadow-[0_0_18px_rgba(255,184,77,0.85)]" : "bg-[#2F7CFF]")} />
                        <article className={cn("glass-card h-[200px] flex flex-col p-4 text-sm", tone)}>
                          <p className="font-semibold">{item.title}</p>
                          <p className="mt-2 leading-snug flex-1 line-clamp-4">{item.topic}</p>
                          <p className="text-xs uppercase tracking-wide text-zinc-300 mt-auto">{item.date}</p>
                        </article>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-10 xl:hidden">
              <div className="relative ml-4 border-l border-[#2F65D8]/30 pl-8">
                {timeline.map((item) => {
                  const state = getTimelineItemState(item.eventDate, effectiveTimelineReferenceDate);
                  return (
                    <article key={item.title} className="relative mb-6">
                      <span className={cn("absolute -left-[42px] top-8 h-4 w-4 rounded-full", state === "completed" ? "bg-[#00D27A]" : state === "current" ? "bg-[#43D5FF] shadow-[0_0_18px_rgba(67,213,255,0.9)]" : item.isActive ? "bg-[#FFB84D] shadow-[0_0_18px_rgba(255,184,77,0.85)]" : "bg-[#2F7CFF]")} />
                      <div className="glass-card p-5 flex flex-col h-[180px]">
                        <p className="text-sm font-semibold text-zinc-100">{item.title}</p>
                        <p className="mt-1 text-base text-white flex-1 line-clamp-3">{item.topic}</p>
                        <p className="text-xs tracking-wide text-zinc-300 mt-auto">{item.date}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="section-shell grid gap-6 md:grid-cols-3">
            {eventCards.map((card) => (
              <article key={card.title} className="glass-card p-6">
                <card.icon className="h-7 w-7 text-[#43D5FF]" />
                <h3 className="mt-4 text-xl font-semibold text-white">{card.title}</h3>
                <p className="mt-3 text-zinc-200">{card.value}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="py-12">
          <div className="section-shell">
            <h2 className="font-(family-name:--font-poppins) text-center text-4xl font-bold text-white sm:text-[42px]">Workshop Benefits</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((benefit, index) => (
                <motion.article
                  key={benefit.label}
                  className="glass-card flex items-center gap-4 p-5"
                  whileHover={{ y: -6, scale: 1.02 }}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.45 }}
                  viewport={{ once: true, amount: 0.35 }}
                >
                  <div className="rounded-2xl bg-[#43D5FF]/15 p-3 shadow-[0_0_25px_rgba(67,213,255,0.3)]">
                    <benefit.icon className="h-6 w-6 text-[#56A6FF]" />
                  </div>
                  <p className="text-lg text-zinc-100">{benefit.label}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="registration" className="py-24">
          <div className="section-shell">
            <motion.div
              className="glass-card relative overflow-hidden p-8 sm:p-12"
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.4 }}
            >
              <div className="absolute -right-10 -top-14 h-56 w-56 rounded-full bg-[#43D5FF]/20 blur-3xl" aria-hidden="true" />
              <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#2F7CFF]/30 blur-3xl" aria-hidden="true" />
              <div className="relative z-10 grid gap-8 lg:grid-cols-[220px_1fr] lg:items-center">
                <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-3xl border border-white/20 bg-black/25 p-5">
                  <div className="grid h-full w-full grid-cols-7 grid-rows-7 gap-1.5 rounded-2xl bg-white p-3">
                    {Array.from({ length: 49 }).map((_, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "rounded-[3px]",
                          [0, 1, 2, 7, 9, 14, 16, 35, 36, 37, 42, 44, 47].includes(idx) ? "bg-black" : "bg-zinc-200",
                        )}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm tracking-[0.18em] text-[#56A6FF]">REGISTRATION OPEN</p>
                  <h2 className="mt-3 font-(family-name:--font-poppins) text-4xl font-bold text-white sm:text-[42px]">Join LIBRARY AI LAB</h2>
                  <p className="mt-4 text-lg text-zinc-200">Reserve your seat for a high-impact learning series focused on practical AI for academic excellence.</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-4">
                    {[
                      { label: "Days", value: countdownLoaded ? countdown.days : 0 },
                      { label: "Hours", value: countdownLoaded ? countdown.hours : 0 },
                      { label: "Minutes", value: countdownLoaded ? countdown.minutes : 0 },
                      { label: "Seconds", value: countdownLoaded ? countdown.seconds : 0 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-white/20 bg-white/10 p-3 text-center">
                        <p className="text-2xl font-bold text-white">{String(item.value).padStart(2, "0")}</p>
                        <p className="mt-1 text-xs uppercase tracking-wider text-zinc-300">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-zinc-300">
                    {countdown.expired ? "Registration period closed." : "Maximum participants: 40 seats only."}
                  </p>
                  <Link
                    href="/registration"
                    className="focus-ring mt-6 inline-flex items-center rounded-full bg-gradient-to-r from-[#2F7CFF] to-[#43D5FF] px-8 py-4 font-semibold text-white shadow-[0_0_30px_rgba(67,213,255,0.5)] transition hover:scale-105 hover:shadow-[0_0_38px_rgba(67,213,255,0.65)]"
                    aria-label="Open registration form"
                  >
                    Register Now
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="pb-24 pt-6">
          <div className="section-shell max-w-4xl">
            <h2 className="font-(family-name:--font-poppins) text-center text-4xl font-bold text-white sm:text-[42px]">Frequently Asked Questions</h2>
            <div className="mt-10">
              <Accordion type="single" collapsible className="space-y-3" aria-label="Frequently asked questions">
                {faq.map((item) => (
                  <AccordionItem key={item.question} value={item.question}>
                    <AccordionTrigger className="text-[17px] sm:text-[18px]">{item.question}</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-zinc-300">{item.answer}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {posterOpen && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/78 p-4 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label="Workshop poster preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={() => setPosterOpen(false)}
          >
            <motion.div
              className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-white/20 bg-[#0b0a16]/75 p-2 shadow-[0_16px_80px_rgba(0,0,0,0.55)] backdrop-blur"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.985 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="focus-ring absolute right-3 top-3 z-10 rounded-full border border-white/25 bg-black/45 px-3 py-1 text-sm text-white"
                onClick={() => setPosterOpen(false)}
                aria-label="Close poster preview"
              >
                Close
              </button>
              <button
                type="button"
                className="focus-ring absolute left-3 top-3 z-10 rounded-full border border-white/25 bg-black/45 px-3 py-1 text-sm text-white"
                onClick={() => {
                  if (posterZoom === 1) {
                    const viewport = posterViewportRef.current;
                    if (viewport) {
                      posterPreZoomScrollRef.current = {
                        left: viewport.scrollLeft,
                        top: viewport.scrollTop,
                      };
                    }
                    setPosterZoom(2);
                    return;
                  }

                  pendingPosterRestoreRef.current = true;
                  setPosterZoom(1);
                }}
                aria-label={posterZoom === 1 ? "Zoom in poster" : "Reset poster zoom"}
              >
                {posterZoom === 1 ? "Zoom 100%" : "Reset zoom"}
              </button>
              <div
                ref={posterViewportRef}
                className={cn(
                  "relative max-h-[88vh] overflow-auto rounded-xl border border-white/10 bg-[#060510]/45 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
                  posterZoom === 1 ? "cursor-zoom-in" : "cursor-zoom-out",
                )}
                onClick={handlePosterViewportClick}
              >
                <div style={{ width: `${posterZoom * 100}%` }}>
                  <Image
                    src={posterImage}
                    alt="LIBRARY AI LAB workshop poster"
                    width={posterImage.width}
                    height={posterImage.height}
                    sizes="100vw"
                    priority
                    draggable={false}
                    className="h-auto w-full select-none object-contain"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer id="contact" className="border-t border-white/10 bg-black/35 py-12">
        <div className="section-shell grid gap-8 lg:grid-cols-[1.1fr_0.9fr_0.8fr] lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-xl font-semibold text-white">
              <BookOpen size={20} className="text-[#56A6FF]" />
              <h3>หอสมุดและคลังความรู้มหาวิทยาลัยมหิดล</h3>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
              <p className="pl-6">25/25 หมู่ 5 ถนนพุทธมณฑลสาย 4 ตำบลศาลายา</p>
              <p className="pl-6">อำเภอพุทธมณฑล จังหวัดนครปฐม 73170</p>
              <a href="mailto:liwww@mahidol.ac.th" className="flex items-center gap-2 text-[#56A6FF] transition hover:text-cyan-200">
                <Mail size={16} className="shrink-0" />
                <span>liwww@mahidol.ac.th</span>
              </a>
              <a href="https://www.li.mahidol.ac.th" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#56A6FF] transition hover:text-cyan-200">
                <Globe2 size={16} className="shrink-0" />
                <span>https://www.li.mahidol.ac.th</span>
              </a>
              <div className="flex items-start gap-2">
                <Phone size={16} className="mt-0.5 shrink-0 text-[#56A6FF]" />
                <p>สอบถามบริการห้องสมุด 0-2800-2680-9 ต่อ 4225, 4264</p>
              </div>
              <div className="flex items-start gap-2">
                <Phone size={16} className="mt-0.5 shrink-0 text-[#56A6FF]" />
                <p>สำนักงานผู้อำนวยการ โทร. 0-2441-9581</p>
              </div>
              <div className="flex items-start gap-2">
                <Printer size={16} className="mt-0.5 shrink-0 text-[#56A6FF]" />
                <p>โทรสาร 0-2441-9580</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start">
            <p className="text-sm tracking-[0.2em] text-[#56A6FF]">สอบถามรายละเอียดเพิ่มเติม</p>
            <p className="mt-3 text-zinc-300">นายศกล มงคลเนตร์</p>
            <p className="mt-1 text-zinc-300">หอสมุดและคลังความรู้มหาวิทยาลัยมหิดล</p>
            <p className="mt-4 text-zinc-300">สำนักงาน: 0-2800-2680-9 ต่อ 4224</p>
            <p className="mt-1 text-zinc-300">โทรศัพท์: 095-195-1929</p>
            <p className="mt-1 text-zinc-300">อีเมล: sakol.mon@mahidol.ac.th</p>
          </div>

          <div className="md:text-right">
            <div className="flex flex-col items-start md:items-end">
              <Link
                href="/admin"
                className="focus-ring inline-flex items-center justify-center rounded-full border border-[#FFB84D]/55 bg-[#FFB84D]/12 px-5 py-3 text-sm font-semibold text-[#FFE4B5] transition hover:bg-[#FFB84D]/20 hover:text-white"
              >
                Login as Admin
              </Link>
              <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/8 px-4 py-2 text-zinc-200">
                <UserRound size={16} />
                Follow us on social media
              </div>
              <div className="mt-5 flex flex-wrap gap-3 md:justify-end">
                {[
                  {
                    label: "Facebook",
                    href: "https://www.facebook.com/MahidolLibrary/",
                    icon: (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                        <path d="M13 2H10a4 4 0 0 0-4 4v3H3v4h3v8h4v-8h3l1-4H10V6a1 1 0 0 1 1-1h2z" />
                      </svg>
                    ),
                  },
                  {
                    label: "Instagram",
                    href: "https://www.instagram.com/mahidollibrary",
                    icon: (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.7]">
                        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
                        <circle cx="12" cy="12" r="4.25" />
                        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                      </svg>
                    ),
                  },
                  {
                    label: "YouTube",
                    href: "https://www.youtube.com/channel/UCsaXPO0j57cCfOQkuGHrGzA",
                    icon: (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                        <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18.3 4.8 12 4.8 12 4.8s-6.3 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.6 2 12 2 12s0 3.4.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.4.5 7.7.5 7.7.5s6.3 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9C22 15.4 22 12 22 12s0-3.4-.4-4.8ZM10 15.5v-7l6 3.5-6 3.5Z" />
                      </svg>
                    ),
                  },
                  {
                    label: "TikTok",
                    href: "https://www.tiktok.com/@mahidollibrary",
                    icon: (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                        <path d="M14.3 2h2.8a5.2 5.2 0 0 0 5.2 5.2v2.9a8.1 8.1 0 0 1-5.2-1.7v7.3a6.2 6.2 0 1 1-6.2-6.2c.3 0 .6 0 .9.1v3a3.2 3.2 0 1 0 2.3 3.1V2Z" />
                      </svg>
                    ),
                  },
                  {
                    label: "LINE",
                    href: "https://lin.ee/S5yFlTR",
                    icon: (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                        <path d="M18.8 7.2c-.7-1.1-2-1.8-4.1-1.8H9.4c-2.2 0-3.5.7-4.2 1.8-.7 1.1-.7 2.6 0 3.8.6 1 1.8 1.6 3.7 1.8l-.9 2.2a.3.3 0 0 0 .4.4l2.8-1.8c.3-.2.7-.2 1-.2h1.3c2.2 0 3.5-.7 4.2-1.8.7-1.1.7-2.6 0-3.8Z" />
                      </svg>
                    ),
                  },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:border-cyan-200/60 hover:text-cyan-100"
                    aria-label={`Open ${item.label}`}
                  >
                    {item.icon}
                  </a>
                ))}
              </div>
            </div>
            <p className="mt-8 text-sm text-zinc-400">© 2026 LIBRARY AI LAB. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
