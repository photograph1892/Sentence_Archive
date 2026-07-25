"use client";

import { useEffect, useMemo, useState } from "react";

const sentences = [
  ["사랑하지 않는 자들에게", "노래를 들어보라 한다.", "꽃을 보라 한다."],
  ["마음이 머무는 곳마다", "작은 문장이 피어난다.", "오늘을 오래 바라본다."],
  ["다정함을 잊지 않으려고", "한 줄을 천천히 적는다.", "내일의 나에게 건넨다."],
  ["우리는 문장 사이에서", "서로의 계절을 발견한다.", "그리고 잠시 머문다."],
];

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}. ${month}. ${day}.`;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .toLowerCase();
}

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const sentence = useMemo(() => {
    const today = new Date();
    const dayNumber = Math.floor(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000,
    );
    return sentences[dayNumber % sentences.length];
  }, []);

  const displayDate = now ?? new Date(2026, 6, 25, 3, 3);
  const weekday = weekdays[displayDate.getDay()];

  return (
    <main className="calendar-page">
      <header className="topbar" aria-label="주요 메뉴">
        <div className="rule" aria-hidden="true" />
        <a className="wordmark" href="#" aria-label="문장달력소 홈">
          문장달력소
        </a>
        <nav className="nav-actions">
          <a href="#drawer">서랍</a>
          <a href="#collect">수집</a>
        </nav>
      </header>

      <section className="date-area" aria-label={`오늘은 ${formatDate(displayDate)}`}>
        <time dateTime={displayDate.toISOString()}>{formatDate(displayDate)}</time>
      </section>

      <section className="calendar-body" aria-label="오늘의 문장">
        <div className="calendar-inner">
          <p className="author">작성자 본인</p>

          <blockquote>
            {sentence.map((line) => (
              <p key={line}>
                <span>{line}</span>
              </p>
            ))}
          </blockquote>

          <aside className="day-clock" aria-label={`${weekday}, 현재 ${formatTime(displayDate)}`}>
            <strong>{weekday}</strong>
            <span>now {formatTime(displayDate)}</span>
          </aside>
        </div>
      </section>

      <div id="drawer" className="anchor-target" />
      <div id="collect" className="anchor-target" />
    </main>
  );
}
