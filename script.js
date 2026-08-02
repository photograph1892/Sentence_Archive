const sentences = [
  ["사랑하지 않는 자들에게", "노래를 들어보라 한다.", "꽃을 보라 한다."],
];

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dateElement = document.querySelector("#current-date");
const timeElement = document.querySelector("#current-time");
const weekdayElement = document.querySelector("#weekday");
const sentenceElement = document.querySelector("#daily-sentence");
const mainAuthorElement = document.querySelector("#main-author");
const collectorDateElements = document.querySelectorAll(".collector-date");
const themeStorageKey = "sentence-calendar-theme-v1";
const themeButtons = document.querySelectorAll(".theme-button");

function applyTheme(theme, persist = false) {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selectedTheme;
  themeButtons.forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.themeValue === selectedTheme),
    );
  });

  if (persist) {
    try {
      localStorage.setItem(themeStorageKey, selectedTheme);
    } catch {
      // 저장소를 사용할 수 없어도 현재 화면의 테마 전환은 유지합니다.
    }
  }

  applyDailyPalette(new Date());
}

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeValue, true);
  });
});

applyTheme(document.documentElement.dataset.theme);

function appendHoverGlyphs(target, text, classNameForIndex = null) {
  Array.from(text).forEach((character, index) => {
    const glyph = document.createElement("span");
    glyph.className = "hover-glyph";
    const additionalClass = classNameForIndex?.(character, index);
    if (additionalClass) glyph.classList.add(additionalClass);
    glyph.textContent = character;
    target.append(glyph);
  });
}

function prepareStaticMainText() {
  const clockLabel = timeElement.parentElement;
  const clockPrefix = document.createElement("span");
  clockPrefix.className = "clock-prefix";
  appendHoverGlyphs(clockPrefix, "now ");
  clockLabel.replaceChildren(clockPrefix, timeElement);

  const moreButton = document.querySelector("#main-more");
  const moreText = moreButton.textContent.trim();
  moreButton.replaceChildren();
  appendHoverGlyphs(moreButton, moreText);
}

prepareStaticMainText();

function getDayNumber(date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

function createDailyRandom(seed) {
  return function random() {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hslToRgb(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1
      ? [chroma, secondary, 0]
      : section < 2
        ? [secondary, chroma, 0]
        : section < 3
          ? [0, chroma, secondary]
          : section < 4
            ? [0, secondary, chroma]
            : section < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const offset = l - chroma / 2;

  return [red, green, blue].map((channel) =>
    Math.round((channel + offset) * 255),
  );
}

function relativeLuminance(rgb) {
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function mixRgb(rgb, target, amount) {
  return rgb.map((channel, index) =>
    Math.round(channel + (target[index] - channel) * amount),
  );
}

function constrainLuminance(rgb, minimum = 0.42, maximum = 0.78) {
  let adjusted = rgb;
  let luminance = relativeLuminance(adjusted);

  for (let step = 0; step < 24 && luminance < minimum; step += 1) {
    adjusted = mixRgb(adjusted, [255, 255, 255], 0.08);
    luminance = relativeLuminance(adjusted);
  }

  for (let step = 0; step < 24 && luminance > maximum; step += 1) {
    adjusted = mixRgb(adjusted, [0, 0, 0], 0.035);
    luminance = relativeLuminance(adjusted);
  }

  return adjusted;
}

function rgbCss(rgb) {
  return `rgb(${rgb.join(", ")})`;
}

function complementaryPairDistance(firstHue, secondHue) {
  const difference = Math.abs(firstHue - secondHue) % 180;
  return Math.min(difference, 180 - difference);
}

function getDistinctDailyHue(date) {
  const year = date.getFullYear();
  const targetDay = Math.floor(
    (Date.UTC(year, date.getMonth(), date.getDate()) -
      Date.UTC(year, 0, 1)) /
      86_400_000,
  );
  let previousHue = null;

  for (let day = 0; day <= targetDay; day += 1) {
    const random = createDailyRandom(year * 1000 + day);
    let selectedHue = Math.floor(random() * 360);

    if (previousHue !== null) {
      let attempts = 0;
      while (
        complementaryPairDistance(selectedHue, previousHue) < 75 &&
        attempts < 12
      ) {
        selectedHue = Math.floor(random() * 360);
        attempts += 1;
      }

      if (complementaryPairDistance(selectedHue, previousHue) < 75) {
        selectedHue = (previousHue + 90) % 360;
      }
    }

    previousHue = selectedHue;
  }

  return previousHue;
}

function applyDailyPalette(date) {
  const random = createDailyRandom(getDayNumber(date));
  const mainHue = getDistinctDailyHue(date);
  const isDarkTheme = document.documentElement.dataset.theme === "dark";
  const saturation = isDarkTheme
    ? 95 + random() * 5
    : 85 + random() * 15;
  const lightness = 50 + random() * 32;
  const minimumLuminance = isDarkTheme ? 0.1 : 0.18;
  const maximumLuminance = isDarkTheme ? 0.32 : 0.78;
  const companionLuminanceDistance = isDarkTheme ? 0.1 : 0.2;
  const mainColor = constrainLuminance(
    hslToRgb(mainHue, saturation, lightness),
    minimumLuminance,
    maximumLuminance,
  );
  const mainLuminance = relativeLuminance(mainColor);
  const subMinimumLuminance = Math.max(
    minimumLuminance,
    mainLuminance - companionLuminanceDistance,
  );
  const subMaximumLuminance = Math.min(
    maximumLuminance,
    mainLuminance + companionLuminanceDistance,
  );
  const subColor = constrainLuminance(
    hslToRgb((mainHue + 180) % 360, saturation, lightness),
    subMinimumLuminance,
    subMaximumLuminance,
  );

  document.documentElement.style.setProperty(
    "--main-color",
    rgbCss(mainColor),
  );
  document.documentElement.style.setProperty("--sub-color", rgbCss(subColor));
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}. ${month}. ${day}.`;
}

function renderDate(date) {
  const dateParts = [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ];

  dateElement.replaceChildren();

  dateParts.forEach((part) => {
    const number = document.createElement("span");
    number.className = "date-number";
    appendHoverGlyphs(number, part);

    const dot = document.createElement("span");
    dot.className = "date-dot hover-glyph";
    dot.textContent = "▪";
    dot.setAttribute("aria-hidden", "true");

    dateElement.append(number, dot);
  });
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .toLowerCase();
}

function renderTime(timeText) {
  const [hour = "", minuteAndPeriod = ""] = timeText.split(":");
  const separator = document.createElement("span");
  separator.className = "clock-separator hover-glyph";
  separator.textContent = ":";
  separator.setAttribute("aria-hidden", "true");

  timeElement.replaceChildren();
  appendHoverGlyphs(timeElement, hour);
  timeElement.append(separator);
  appendHoverGlyphs(timeElement, minuteAndPeriod);
  timeElement.setAttribute("aria-label", timeText);
}

function showDailySentence(date) {
  const sentence = sentences[getDayNumber(date) % sentences.length];
  renderMainSentence(sentence, "문장달력소");
}

function renderMainSentence(lines, author) {
  sentenceElement.replaceChildren();
  mainAuthorElement.replaceChildren();
  appendHoverGlyphs(mainAuthorElement, author);
  mainAuthorElement.classList.remove("is-overflowing");

  lines.forEach((line) => {
    const paragraph = document.createElement("p");
    const text = document.createElement("span");
    appendHoverGlyphs(text, line);
    paragraph.append(text);
    sentenceElement.append(paragraph);
  });

  requestAnimationFrame(() => {
    fitMainSentenceLines();
    updateMainAuthorOverflow();
  });
}

function updateMainAuthorOverflow() {
  mainAuthorElement.classList.remove("is-overflowing");
  const lineHeight =
    Number.parseFloat(getComputedStyle(mainAuthorElement).lineHeight) || 0;
  const overflowsThreeLines =
    mainAuthorElement.scrollHeight > lineHeight * 3 + 1;
  mainAuthorElement.classList.toggle("is-overflowing", overflowsThreeLines);
}

function fitMainSentenceLines() {
  const paragraphs = Array.from(sentenceElement.querySelectorAll("p"));
  if (!paragraphs.length || !sentenceElement.clientWidth) return;

  paragraphs.forEach((paragraph) => {
    paragraph.style.removeProperty("font-size");
  });

  const requiredScale = Math.min(
    1,
    ...paragraphs.map((paragraph) => {
      const textWidth = paragraph.querySelector("span").scrollWidth;
      return textWidth > 0 ? paragraph.clientWidth / textWidth : 1;
    }),
  );

  if (requiredScale >= 1) return;

  const baseSize = Number.parseFloat(getComputedStyle(paragraphs[0]).fontSize);
  const fittedSize = Math.max(12, baseSize * requiredScale);

  paragraphs.forEach((paragraph) => {
    paragraph.style.fontSize = `${fittedSize}px`;
  });
}

function renderWeekday(weekday) {
  weekdayElement.replaceChildren();
  appendHoverGlyphs(weekdayElement, weekday, (_character, index) => {
    if (weekday === "Wed" && index === 1) return "weekday-wed-e";
    if (weekday === "Wed" && index === 2) return "weekday-wed-d";
    if (weekday === "Thu" && index === 2) return "weekday-thu-u";
    return "";
  });
}

let displayedCalendarDayNumber = null;

function updateCalendar() {
  const now = new Date();
  const currentDayNumber = getDayNumber(now);
  const dateChangedWhileOpen =
    displayedCalendarDayNumber !== null &&
    displayedCalendarDayNumber !== currentDayNumber;
  displayedCalendarDayNumber = currentDayNumber;
  const dateText = formatDate(now);
  const timeText = formatTime(now);

  applyDailyPalette(now);
  renderDate(now);
  dateElement.dateTime = now.toISOString();
  dateElement.parentElement.setAttribute("aria-label", `오늘은 ${dateText}`);

  renderWeekday(weekdays[now.getDay()]);
  renderTime(timeText);
  timeElement.dateTime = now.toISOString();
  if (dateChangedWhileOpen) {
    collectorStorageReady.then(showRandomCollectedSentence);
  }
  document.querySelector(".day-clock").setAttribute(
    "aria-label",
    `${weekdays[now.getDay()]}, 현재 ${timeText}`,
  );

}

updateCalendar();
showDailySentence(new Date());
window.setInterval(updateCalendar, 30_000);

const characterMotionSettings = [
  [".character-pink", "left", 2100, 430],
  [".character-orange", "left", 3600, 370],
  [".character-yellow", "left", 5200, 450],
  [".character-green", "right", 4300, 400],
  [".character-blue", "right", 2800, 470],
];
const characterMotionStates = new WeakMap();
const characterMessages = {
  pink: {
    name: "분홍이",
    seasonalMessages: {
      spring: {
        related: [
          "안녕...! 봄바람이 조금 따뜻해졌네.",
          "벚꽃이 하나둘 피기 시작했어.",
          "오늘 햇살은 문장을 읽기 딱 좋은 것 같아.",
          "연둣빛 잎을 보면 괜히 마음이 편안해져.",
          "봄에는 새로운 문장을 만나고 싶어져.",
          "꽃향기가 나는 날엔 문장도 조금 다르게 읽히는 것 같아.",
          "봄비가 내리면 세상이 조용해지는 것 같아.",
          "따뜻한 바람이 불면 산책하고 싶은 마음이 들어.",
          "봄 하늘은 왠지 더 맑고 부드러워 보여.",
          "작은 꽃 하나를 발견하면 괜히 기분이 좋아져.",
          "꽃이 피는 모습을 보면 새로운 시작이 떠올라.",
          "봄 햇살 아래에서는 짧은 문장도 오래 머무는 것 같아.",
          "새싹이 돋아나는 걸 보면 마음도 조금 가벼워져.",
          "포근한 날씨에는 천천히 문장을 읽고 싶어져.",
          "봄은 마음속에 작은 설렘을 가져오는 계절인 것 같아.",
        ],
        general: [
          "안녕...! 오늘은 어떤 문장을 만나게 될까?",
          "혹시 마음에 오래 남은 문장이 있어?",
          "같이 문장을 읽으면 조금 가까워질 수 있을까?",
          "이 문장은 너에게 어떤 느낌일지 궁금해.",
          "천천히 읽어도 괜찮아.",
          "마음에 드는 문장을 만나면 괜히 반가워져.",
          "같은 문장을 좋아하는 사람을 만나면 기뻐.",
          "문장은 사람을 조금 닮는 것 같지 않아?",
          "오늘은 어떤 마음으로 여기 왔어?",
          "괜찮다면 이 문장을 천천히 읽어 봐.",
          "나는 문장을 통해 사람을 알아 가는 게 좋아.",
          "문장을 읽다 보면 마음이 따뜻해질 때가 있어.",
          "오늘은 어떤 문장이 너를 기다리고 있을까?",
          "네가 좋아하는 문장이 궁금해.",
          "이곳에서는 천천히 머물러도 괜찮아.",
        ],
      },
      summer: {
        related: [
          "초여름이 찾아왔네. 햇살이 조금씩 뜨거워지고 있어.",
          "요즘은 낮 시간이 길어져서 하루가 더 크게 느껴지는 것 같아.",
          "매미 소리가 들리기 시작했어. 여름이 왔나 봐.",
          "장마철에는 빗소리를 들으며 문장을 읽고 싶어져.",
          "비 오는 날엔 마음도 조금 차분해지는 것 같아.",
          "여름 하늘은 유난히 파랗고 넓어 보여.",
          "구름이 천천히 움직이는 걸 보고 있으면 마음도 느긋해져.",
          "더운 날에는 시원한 곳에서 문장 하나 읽고 싶어.",
          "초록 나무들이 가장 싱그러운 계절이네.",
          "햇살이 강한 날에는 그늘 같은 문장이 생각나.",
          "여름밤에는 이상하게 생각이 많아지는 것 같아.",
          "수박처럼 달콤한 문장을 만나면 좋겠다.",
          "바람이 살짝 불어오는 오후는 참 편안한 것 같아.",
          "한여름의 풍경도 언젠가는 좋은 기억이 되겠지.",
          "더운 계절에도 따뜻한 마음은 그대로 남아 있는 것 같아.",
        ],
        general: [
          "혹시 오늘 가장 먼저 떠오른 문장이 있었어?",
          "마음에 드는 문장은 몇 번이고 다시 읽게 되더라.",
          "너는 어떤 문장에서 위로를 받는 편이야?",
          "문장을 좋아하는 이유가 궁금해.",
          "오늘은 어떤 기분으로 문장을 읽고 있어?",
          "마음에 남는 한 줄이 하루를 바꾸기도 하더라.",
          "같은 문장도 읽는 날에 따라 다르게 느껴지는 것 같아.",
          "문장을 읽을 때 가장 먼저 눈에 들어오는 건 뭐야?",
          "천천히 읽으면 보이는 것들이 있는 것 같아.",
          "이 문장은 어떤 이야기를 담고 있을까?",
          "가끔은 짧은 문장이 더 오래 기억에 남더라.",
          "좋아하는 문장을 다시 찾아본 적 있어?",
          "문장을 모으다 보면 취향도 조금씩 보이는 것 같아.",
          "오늘은 어떤 문장이 너를 미소 짓게 할까?",
          "문장을 좋아하는 마음이 참 따뜻한 것 같아.",
        ],
      },
      autumn: {
        related: [
          "바람이 조금 선선해졌네. 가을이 가까워지고 있나 봐.",
          "가을 하늘은 유난히 높고 맑아 보여.",
          "단풍이 물들기 시작했어. 색깔이 참 예쁜 계절이야.",
          "낙엽이 떨어지는 모습을 보면 시간이 천천히 흐르는 것 같아.",
          "아침저녁으로는 조금 쌀쌀해졌네.",
          "따뜻한 차 한 잔과 문장 하나가 잘 어울리는 계절이야.",
          "가을 햇살은 여름과 다른 포근함이 있는 것 같아.",
          "선선한 바람을 맞으면 괜히 생각이 많아져.",
          "책 읽기 좋은 계절이 찾아온 것 같아.",
          "길 위의 낙엽도 작은 이야기처럼 보여.",
          "가을에는 오래된 문장을 다시 읽고 싶어져.",
          "맑은 하늘을 보면 마음도 조금 정리되는 것 같아.",
          "긴 소매를 꺼내는 계절이 왔네.",
          "조용한 가을 오후에는 문장이 더 잘 어울리는 것 같아.",
          "가을은 마음속에 오래 머무는 계절인 것 같아.",
        ],
        general: [
          "오늘은 어떤 문장이 너에게 남을까?",
          "혹시 오래 간직하고 싶은 문장을 만난 적 있어?",
          "문장을 다시 읽으면 새로운 마음이 보일 때가 있어.",
          "이 문장을 처음 만났을 때가 궁금해.",
          "좋은 문장은 조용히 곁에 머무는 것 같아.",
          "너만 알고 있는 특별한 문장이 있을까?",
          "문장을 모으는 건 마음을 모으는 일과 비슷한 것 같아.",
          "어떤 문장은 시간이 지나야 더 좋아지는 것 같지 않아?",
          "오늘의 마음과 어울리는 문장이 있을까?",
          "문장을 좋아하는 마음도 하나의 소중한 취향인 것 같아.",
          "저장해 둔 문장 중 다시 보고 싶은 문장이 있어?",
          "한 문장이 누군가를 이해하게 해 줄 때도 있는 것 같아.",
          "문장은 말보다 더 많은 이야기를 전해 주는 것 같아.",
          "마음속에 남은 문장이 있다는 건 참 좋은 일인 것 같아.",
          "어떤 문장을 좋아하는지 알면 그 사람도 조금 알 수 있을 것 같아.",
        ],
      },
      winter: {
        related: [
          "오늘은 많이 춥지 않아? 따뜻하게 입고 다녀.",
          "겨울바람이 차가워졌네. 손은 괜찮아?",
          "첫눈이 내리면 세상이 잠시 조용해지는 것 같아.",
          "눈 오는 날에는 문장이 더 포근하게 느껴지는 것 같아.",
          "따뜻한 차 한 잔이 생각나는 계절이야.",
          "겨울 하늘은 차갑지만 맑아서 예쁜 것 같아.",
          "목도리와 장갑이 필요한 계절이 왔네.",
          "추운 날에는 따뜻한 문장 하나가 더 소중하게 느껴져.",
          "하얀 눈 위에 남은 발자국도 하나의 이야기처럼 보여.",
          "겨울밤은 길어서 생각할 시간이 많아지는 것 같아.",
          "창밖의 겨울 풍경을 보며 문장을 읽고 싶어져.",
          "차가운 공기 속에서도 따뜻한 마음은 남아 있는 것 같아.",
          "겨울에는 작은 위로가 더 크게 느껴지는 것 같아.",
          "포근한 이불 속에서 읽는 문장은 특별한 것 같아.",
          "추운 계절일수록 마음을 따뜻하게 해 주는 문장이 필요한 것 같아.",
        ],
        general: [
          "오늘은 어떤 문장이 너의 마음에 머물까?",
          "혹시 이 문장을 왜 저장했는지 기억나?",
          "오래전에 모아 둔 문장이 다시 다르게 느껴질 때가 있어.",
          "마음에 남는 문장은 꼭 이유가 있는 것 같아.",
          "이 문장을 읽고 떠오르는 사람이 있어?",
          "어떤 문장은 조용히 위로를 건네는 것 같아.",
          "너의 문장 취향을 조금씩 알아가는 게 즐거워.",
          "혹시 문장을 모으게 된 특별한 이유가 있어?",
          "같은 글도 읽는 사람에 따라 다른 이야기가 되는 것 같아.",
          "오늘의 마음과 닮은 문장을 찾았으면 좋겠다.",
          "짧은 한 줄이 오래 기억되는 순간이 있는 것 같아.",
          "문장을 함께 나누는 건 마음을 나누는 일과 비슷한 것 같아.",
          "이곳에 모인 문장들은 모두 작은 기억이 될 것 같아.",
          "혹시 오늘 가장 마음에 남은 단어가 있었어?",
          "좋아하는 문장이 있다는 건 참 따뜻한 일인 것 같아.",
        ],
      },
    },
  },
  orange: {
    name: "주황이",
    seasonalMessages: {
      spring: {
        related: [
          "봄이 왔네! 새로운 문장을 만나기 좋은 계절이야.",
          "꽃이 피기 시작했어. 괜히 기분까지 밝아지는 것 같지 않아?",
          "따뜻한 바람이 불면 밖으로 나가고 싶어져.",
          "봄 햇살 아래에서 읽는 문장은 더 특별할 것 같아.",
          "벚꽃이 피었네! 이런 풍경은 꼭 기억해 두고 싶어.",
          "겨울이 지나고 새로운 계절이 시작됐어.",
          "연둣빛 풍경이 가득해졌네. 보기만 해도 기분 좋아져!",
          "봄비가 내리는 날엔 조용히 문장을 읽어 보는 것도 좋겠다.",
          "날씨가 좋아졌으니 새로운 곳에서 문장을 찾아보는 건 어때?",
          "작은 변화가 모여서 멋진 계절을 만드는 것 같아.",
          "꽃잎이 흩날리는 풍경은 오래 기억하고 싶어지는 순간이야.",
          "봄에는 새로운 생각들이 많이 떠오르는 것 같아.",
          "따뜻한 날씨처럼 마음도 조금 가벼워졌으면 좋겠다.",
          "봄의 순간들을 하나씩 기록해 두고 싶지 않아?",
          "이렇게 좋은 계절엔 좋은 문장도 더 많이 만나고 싶어!",
        ],
        general: [
          "좋은 문장은 발견하면 바로 기억해 둬야지!",
          "이 문장 꽤 괜찮은데? 너는 어떻게 생각해?",
          "마음에 들면 저장해 두자. 나중에 다시 보면 더 좋을 수도 있어!",
          "새로운 문장을 만나는 건 새로운 생각을 만나는 거야.",
          "오늘 발견한 문장, 누군가에게 들려주고 싶지 않아?",
          "이런 문장은 혼자 보기 아까운걸?",
          "너는 어떤 문장을 보면 바로 저장하고 싶어져?",
          "마음에 남는 문장은 이유가 꼭 있는 것 같아.",
          "좋은 건 오래 기억해야 해. 문장도 마찬가지야!",
          "이 문장이 왜 눈에 들어왔는지 궁금한데?",
          "새로운 문장을 찾는 재미, 생각보다 꽤 크지 않아?",
          "네가 좋아하는 문장은 어떤 스타일이야?",
          "한 줄의 문장이 새로운 생각을 시작하게 만들 때가 있어.",
          "마음에 든다면 다른 사람과 나눠 보는 것도 좋겠다!",
          "오늘 발견한 문장 하나, 꽤 멋진 기록이 될 것 같아.",
        ],
      },
      summer: {
        related: [
          "여름이다! 햇빛이 정말 강해졌네.",
          "초여름 냄새가 나는 것 같아. 계절이 바뀌었어!",
          "매미 소리가 들리기 시작했네. 여름이 제대로 왔나 봐.",
          "더운 날에는 시원한 곳에서 문장 하나 읽는 것도 좋겠다.",
          "푸른 나무들이 가장 빛나는 계절이야.",
          "장마가 시작됐네. 빗소리 들으면서 문장을 읽어 보는 건 어때?",
          "여름 하늘은 정말 멋진 배경이 되는 것 같아.",
          "구름 모양을 보는 것도 여름의 작은 재미야.",
          "시원한 음료와 좋은 문장, 꽤 잘 어울리지 않아?",
          "햇빛이 강한 만큼 기억에 남는 순간도 많아지는 것 같아.",
          "여름밤은 뭔가 특별한 분위기가 있어.",
          "더위도 지나고 나면 하나의 추억이 되겠지?",
          "푸른 계절에 새로운 문장을 많이 모아 보자!",
          "휴가철이 다가오네. 새로운 곳에서 새로운 문장을 찾아봐.",
          "뜨거운 여름만큼 마음에 남는 문장도 찾아보자!",
        ],
        general: [
          "이 문장 발견한 거 꽤 잘한 것 같은데?",
          "좋은 문장은 바로 기록해 두는 게 좋아!",
          "너라면 이 문장을 누구에게 보여주고 싶어?",
          "마음에 든 문장은 오래 가지고 있어도 좋잖아.",
          "새로운 문장을 모으는 재미, 알 것 같지 않아?",
          "이 문장의 매력은 어디라고 생각해?",
          "한 번 읽고 지나치기엔 아까운 문장인데?",
          "좋은 생각은 나눌수록 더 커지는 것 같아.",
          "오늘은 어떤 문장이 가장 눈에 들어왔어?",
          "문장 하나가 새로운 이야기를 시작하게 만들기도 해.",
          "네가 모은 문장에는 어떤 공통점이 있을까?",
          "좋은 문장을 발견하는 눈, 점점 생기는 것 같아!",
          "이 문장은 누군가에게 추천하고 싶어지는 느낌이야.",
          "마음에 남았다면 그 이유도 한번 생각해 보자.",
          "오늘의 발견도 멋진 기록으로 남겨 두자!",
        ],
      },
      autumn: {
        related: [
          "가을이 왔네! 하늘이 정말 높아 보여.",
          "단풍이 시작됐어. 이런 풍경은 꼭 남겨 두고 싶다.",
          "선선한 바람이 부니까 걷고 싶은 마음이 들어.",
          "가을에는 새로운 생각이 많이 떠오르는 것 같아.",
          "낙엽이 떨어지는 모습도 꽤 멋진 장면이야.",
          "독서하기 좋은 계절이 왔네. 문장 찾기 딱 좋아!",
          "따뜻한 차 한 잔과 좋은 문장은 최고의 조합 아닐까?",
          "가을 햇살은 분위기가 정말 특별한 것 같아.",
          "맑은 하늘 아래에서 읽는 문장은 더 잘 기억날 것 같아.",
          "가을 풍경처럼 오래 남는 문장을 만나고 싶네.",
          "쌀쌀한 날씨에는 따뜻한 문장이 더 반가워.",
          "낙엽처럼 마음에 내려앉는 문장이 있을지도 몰라.",
          "가을은 기록하고 싶은 순간이 많은 계절이야.",
          "천천히 변하는 계절처럼 문장도 오래 바라보면 좋아.",
          "좋은 계절에는 좋은 문장도 따라오는 것 같아!",
        ],
        general: [
          "이 문장, 그냥 지나치기엔 아까운걸?",
          "좋은 문장을 발견하는 순간은 꽤 특별해.",
          "너는 어떤 기준으로 문장을 저장해?",
          "이 문장을 다른 사람에게 소개한다면 뭐라고 말할래?",
          "마음에 남았다면 그건 분명 이유가 있을 거야.",
          "오늘의 발견, 꽤 괜찮은 기록이 될 것 같아.",
          "문장은 생각보다 많은 이야기를 담고 있어.",
          "새로운 문장을 찾는 건 새로운 시선을 찾는 일이야.",
          "이 문장 속에서 가장 마음에 드는 부분은 어디야?",
          "좋은 문장은 오래 공유될 가치가 있다고 생각해.",
          "네가 모은 문장들을 보면 네 생각도 보일 것 같아.",
          "마음에 드는 건 숨기지 말고 아껴 두자!",
          "오늘 만난 문장도 언젠가 다시 찾게 될 거야.",
          "한 문장이 누군가에게 큰 힘이 될 수도 있어.",
          "문장을 나누는 건 생각을 나누는 일이니까!",
        ],
      },
      winter: {
        related: [
          "겨울이 왔네! 따뜻하게 챙겨 입고 다녀.",
          "날씨가 추워졌어. 따뜻한 음료가 생각나는 계절이다.",
          "첫눈이 오면 꼭 기억하고 싶은 순간이 생기는 것 같아.",
          "하얀 눈이 내리는 풍경은 정말 특별해.",
          "추운 날에는 따뜻한 문장 하나가 더 반갑지 않을까?",
          "겨울 하늘은 차갑지만 정말 맑은 날이 많아.",
          "장갑과 목도리가 필요한 계절이 돌아왔네.",
          "겨울밤에는 생각할 시간이 많아지는 것 같아.",
          "눈 오는 날 좋은 문장을 찾으면 더 기억에 남을 것 같아.",
          "따뜻한 공간에서 읽는 문장은 겨울과 잘 어울려.",
          "차가운 계절에도 새로운 문장은 계속 찾아오는 것 같아.",
          "한 해의 마지막과 시작이 함께 있는 계절이네.",
          "겨울 풍경도 자세히 보면 발견할 게 많아.",
          "추운 날씨 속에서도 마음을 데워 주는 문장이 있으면 좋겠다.",
          "겨울에도 좋은 문장 찾기는 계속되어야지!",
        ],
        general: [
          "좋은 문장은 발견하는 순간이 가장 설레는 것 같아!",
          "이 문장, 저장해 둘 만하지 않아?",
          "너는 이 문장을 누구와 나누고 싶어?",
          "마음에 든다면 오래 기억해 두자.",
          "새로운 문장을 찾는 건 새로운 보물을 찾는 것 같아.",
          "이 문장의 매력, 한번 찾아볼까?",
          "좋은 문장은 혼자 보기 아까운 경우가 많더라.",
          "오늘의 문장 발견, 꽤 멋진 일인데?",
          "이 문장을 고른 이유가 궁금해.",
          "네가 좋아하는 문장에는 분명한 취향이 담겨 있을 거야.",
          "하나의 문장이 새로운 생각을 만들어 낼 수도 있어.",
          "좋은 문장을 발견하면 마음이 조금 더 풍성해지는 것 같아.",
          "이곳에 모이는 문장들이 점점 더 특별해지고 있어.",
          "오늘은 어떤 문장이 가장 눈에 띄었어?",
          "좋은 문장은 오래 남기고, 함께 나누는 게 좋다고 생각해.",
        ],
      },
    },
  },
  yellow: {
    name: "노랑이",
    seasonalMessages: {
      spring: {
        related: [
          "봄이 왔네. 따뜻한 바람이 불어서 좋아.",
          "햇살이 부드러워졌어. 천천히 걷기 좋은 날이야.",
          "꽃이 피는 계절이 찾아왔네.",
          "봄날의 따뜻함처럼 편안한 문장을 만나면 좋겠다.",
          "새싹이 자라는 모습을 보면 마음도 조금 가벼워지는 것 같아.",
          "창문을 열면 봄 냄새가 느껴지는 것 같아.",
          "봄비가 내리는 날은 조용히 쉬기 좋은 날인 것 같아.",
          "따뜻한 날씨에는 좋아하는 문장을 천천히 읽어 보고 싶어.",
          "꽃이 피는 모습을 바라보는 시간도 작은 휴식이 되는 것 같아.",
          "봄 햇살 아래에서는 마음이 조금 느긋해지는 것 같아.",
          "새로운 계절이 시작되었네. 서두르지 않아도 괜찮아.",
          "포근한 바람이 불면 잠시 멈춰 쉬고 싶어져.",
          "봄의 풍경처럼 마음도 조금씩 편안해졌으면 좋겠다.",
          "따뜻한 계절에는 따뜻한 생각이 많이 떠오르는 것 같아.",
          "오늘은 봄처럼 편안한 하루였으면 좋겠다.",
        ],
        general: [
          "오늘은 천천히 문장을 읽어 보는 건 어때?",
          "잠시 쉬어 가고 싶을 때 이곳에 있어도 괜찮아.",
          "마음에 드는 문장은 오래 머물 수 있는 작은 공간이 되는 것 같아.",
          "오늘은 어떤 문장이 편안하게 다가왔어?",
          "모든 문장을 꼭 빨리 이해하지 않아도 괜찮아.",
          "한 줄의 문장만으로도 충분한 하루가 될 수 있어.",
          "마음이 복잡할 때는 짧은 문장 하나도 도움이 될 때가 있어.",
          "문장은 조용히 곁에 머물러 주는 친구 같아.",
          "오늘의 마음에 맞는 문장을 천천히 찾아봐.",
          "아무 생각 없이 쉬어 가는 시간도 필요해.",
          "좋은 문장은 서두르지 않아도 오래 남아.",
          "이곳에서는 잠시 편안하게 머물러도 좋아.",
          "오늘은 어떤 생각을 잠시 내려놓고 싶어?",
          "문장을 읽는 시간만큼은 조금 느긋했으면 좋겠다.",
          "작은 문장 하나가 마음을 쉬게 해 줄 수도 있어.",
        ],
      },
      summer: {
        related: [
          "여름이 다가왔네. 햇빛이 조금 강해졌어.",
          "더운 날에는 시원한 곳에서 잠시 쉬어 가도 좋아.",
          "초록색이 가장 짙어지는 계절이네.",
          "여름 바람이 불면 마음도 조금 느슨해지는 것 같아.",
          "비 오는 날에는 창밖을 보며 쉬고 싶어져.",
          "장마철에는 빗소리도 하나의 위로가 되는 것 같아.",
          "여름 하늘은 넓고 천천히 바라보기 좋은 것 같아.",
          "뜨거운 하루 속에서도 작은 여유를 찾았으면 좋겠다.",
          "시원한 음료와 좋아하는 문장 하나면 충분한 순간도 있어.",
          "나무 그늘 아래처럼 편안한 문장을 만나면 좋겠다.",
          "여름밤에는 조용히 생각하기 좋은 시간이 찾아오는 것 같아.",
          "더위에 지쳤다면 잠시 쉬어 가도 괜찮아.",
          "푸른 풍경을 바라보면 마음도 조금 시원해지는 것 같아.",
          "천천히 지나가는 여름의 순간도 소중한 것 같아.",
          "오늘은 시원하고 편안한 하루였으면 좋겠다.",
        ],
        general: [
          "잠시 쉬면서 문장 하나 읽어 보는 건 어때?",
          "오늘은 어떤 문장이 마음을 편하게 해 줬어?",
          "꼭 특별한 이유가 없어도 문장은 곁에 있을 수 있어.",
          "마음이 지친 날에는 작은 문장도 충분한 위로가 될 수 있어.",
          "천천히 읽는 시간이 생각보다 소중한 것 같아.",
          "오늘 하루도 잘 지나오고 있는 것 같아.",
          "문장은 조용한 공간처럼 머물 곳을 만들어 주는 것 같아.",
          "아무것도 하지 않는 시간도 필요한 것 같아.",
          "지금 마음에 필요한 문장은 어떤 모습일까?",
          "잠시 멈춰서 생각하는 것도 좋은 선택이야.",
          "편안하게 읽을 수 있는 문장을 찾아봐.",
          "마음이 쉬어 갈 자리를 하나 만들어 두면 좋을 것 같아.",
          "오늘은 조금 느리게 가도 괜찮아.",
          "문장은 언제든 다시 돌아올 수 있는 공간 같아.",
          "작은 휴식이 하루를 바꿀 수도 있어.",
        ],
      },
      autumn: {
        related: [
          "가을이 왔네. 바람이 조금 차분해진 것 같아.",
          "선선한 날씨가 마음까지 편안하게 해 주는 것 같아.",
          "가을 햇살은 따뜻하면서도 조용한 느낌이 있어.",
          "낙엽이 떨어지는 풍경을 보고 있으면 마음이 느려지는 것 같아.",
          "따뜻한 차와 문장 하나가 잘 어울리는 계절이네.",
          "맑은 가을 하늘을 천천히 바라보고 싶어져.",
          "가을은 조용히 생각하기 좋은 계절인 것 같아.",
          "책을 읽거나 문장을 바라보기 좋은 날들이 찾아왔어.",
          "선선한 바람처럼 편안한 문장을 만나면 좋겠다.",
          "가을 풍경처럼 마음에도 여유가 생겼으면 좋겠어.",
          "천천히 변하는 계절을 바라보는 것도 좋은 휴식이야.",
          "낙엽처럼 오래 기억되는 순간이 있을 것 같아.",
          "가을 오후의 조용함이 참 좋아.",
          "포근한 옷을 꺼내는 계절이 왔네.",
          "오늘은 가을처럼 차분한 하루였으면 좋겠다.",
        ],
        general: [
          "오늘은 어떤 문장이 마음에 편안하게 머물렀어?",
          "문장을 읽는 시간도 하나의 휴식이 될 수 있어.",
          "마음에 남은 문장은 천천히 바라봐도 좋아.",
          "모든 생각을 잠시 내려놓아도 괜찮아.",
          "조용한 순간에는 작은 문장이 더 잘 들리는 것 같아.",
          "오늘은 마음이 조금 편안해졌으면 좋겠다.",
          "문장은 언제나 같은 자리에서 기다려 주는 것 같아.",
          "지금 필요한 위로가 어떤 모습인지 생각해 봐.",
          "천천히 읽고 천천히 느껴도 괜찮아.",
          "좋은 문장은 마음 한쪽에 작은 공간을 만들어 줘.",
          "오늘 하루의 속도를 조금 늦춰 보는 건 어때?",
          "잠시 쉬어 가는 것도 앞으로 나아가는 방법이야.",
          "마음에 남는 문장은 오래 곁에 있어 주는 것 같아.",
          "오늘은 어떤 문장이 조용한 위로가 될까?",
          "편안한 마음으로 문장을 바라봐도 좋아.",
        ],
      },
      winter: {
        related: [
          "겨울이 왔네. 따뜻하게 입고 다녀.",
          "추운 날에는 따뜻한 공간이 더 소중하게 느껴지는 것 같아.",
          "눈 내리는 풍경은 마음을 조용하게 만들어 주는 것 같아.",
          "겨울밤은 길어서 천천히 생각하기 좋은 시간인 것 같아.",
          "따뜻한 차 한 잔과 문장 하나가 잘 어울리는 계절이야.",
          "차가운 바람 속에서도 작은 따뜻함을 찾을 수 있으면 좋겠다.",
          "포근한 이불 속에서 읽는 문장은 특별한 느낌이 있어.",
          "겨울 하늘은 맑고 고요한 매력이 있는 것 같아.",
          "눈이 내린 거리를 천천히 걷고 싶어지는 날이야.",
          "추운 계절에는 마음을 따뜻하게 해 주는 문장이 더 필요한 것 같아.",
          "조용한 겨울에는 작은 생각도 오래 머무는 것 같아.",
          "따뜻한 옷처럼 편안한 문장을 만나면 좋겠다.",
          "겨울의 고요함도 나름의 아름다움이 있는 것 같아.",
          "차가운 계절에도 마음은 따뜻하게 지낼 수 있어.",
          "오늘은 포근한 하루였으면 좋겠다.",
        ],
        general: [
          "오늘은 잠시 쉬어 가면서 문장을 읽어 봐.",
          "어떤 문장이 지금 마음에 가장 가까워?",
          "문장은 조용히 곁에 머무는 작은 공간 같아.",
          "마음이 복잡할 때는 천천히 읽는 것도 좋아.",
          "오늘의 문장이 작은 위로가 되었으면 좋겠다.",
          "모든 순간을 완벽하게 보내지 않아도 괜찮아.",
          "편안하게 머물 수 있는 공간이 있다는 건 좋은 일인 것 같아.",
          "문장을 읽는 동안 잠시 마음을 쉬게 해 줘.",
          "지금은 어떤 생각을 잠시 내려놓고 싶어?",
          "작은 문장 하나가 하루의 쉼표가 될 수 있어.",
          "천천히 바라본 문장은 더 오래 남는 것 같아.",
          "오늘도 마음에 작은 여유를 만들어 봐.",
          "문장은 조용하지만 오래 곁에 있어 주는 것 같아.",
          "잠시 멈춰 있는 시간도 충분히 의미 있어.",
          "편안한 마음으로 오늘의 문장을 만나 봐.",
        ],
      },
    },
  },
  green: {
    name: "초록이",
    seasonalMessages: {
      spring: {
        related: [
          "봄이 왔네. 겨울 동안 잠들어 있던 것들이 다시 움직이기 시작하는 것 같아.",
          "새싹이 돋아나는 모습을 보면 작은 변화도 의미 있다는 생각이 들어.",
          "봄꽃은 짧게 피지만, 그 순간은 오래 기억되는 것 같아.",
          "따뜻한 바람이 불어오면 새로운 생각이 떠오르는 것 같아.",
          "봄은 시작에 대해 생각하게 만드는 계절인 것 같아.",
          "연둣빛 풍경을 보고 있으면 성장이라는 단어가 떠올라.",
          "봄비는 땅을 적시고 새로운 생명을 돕는 것 같아.",
          "꽃이 피는 과정을 보면 기다림도 하나의 시간이 되는 것 같아.",
          "봄 햇살 아래에서는 작은 문장 하나도 새롭게 보일 때가 있어.",
          "계절이 바뀌는 모습을 보면 나도 조금씩 변하고 있다는 생각이 들어.",
          "피어나는 모든 것에는 각자의 시간이 있는 것 같아.",
          "따뜻한 날씨처럼 마음속 생각도 천천히 풀어지는 것 같아.",
          "봄 풍경 속에는 새로운 질문들이 숨어 있는 것 같아.",
          "오늘 만나는 작은 변화 하나를 기억해 보는 건 어때?",
          "봄은 앞으로 나아가는 것에 대해 생각하게 하는 계절이야.",
        ],
        general: [
          "이 문장은 어떤 질문을 남기는 것 같아?",
          "좋은 문장은 답보다 생각할 거리를 남겨 주는 것 같아.",
          "같은 문장을 읽어도 각자 다른 이야기를 발견하는 것 같아.",
          "이 문장 속에서 가장 궁금한 부분은 어디야?",
          "한 줄의 문장이 새로운 생각의 시작이 될 수도 있어.",
          "문장을 읽고 떠오른 생각을 천천히 따라가 봐.",
          "혹시 이 문장이 어떤 질문을 던지고 있다고 느껴져?",
          "좋은 문장은 쉽게 지나치지 못하게 만드는 힘이 있는 것 같아.",
          "문장을 이해하는 방법은 하나만 있는 게 아닌 것 같아.",
          "이 문장이 너에게 어떤 이야기를 건네는지 궁금해.",
          "오래 생각하게 만드는 문장이 오래 남는 것 같아.",
          "문장은 답을 알려 주기보다 생각할 공간을 만들어 주기도 해.",
          "오늘 만난 문장에서 새로운 관점을 발견했어?",
          "하나의 문장도 바라보는 시선에 따라 달라지는 것 같아.",
          "마음에 남은 질문이 있다면 천천히 들여다봐도 좋아.",
        ],
      },
      summer: {
        related: [
          "여름이 찾아왔네. 뜨거운 계절 속에서도 변화는 계속되는 것 같아.",
          "초록이 가장 짙어지는 계절이라 그런지 생명력이 느껴져.",
          "장마가 지나간 자리에는 새로운 풍경이 남는 것 같아.",
          "여름비를 보고 있으면 자연의 흐름에 대해 생각하게 돼.",
          "뜨거운 햇빛도 누군가에게는 성장의 시간이 되는 것 같아.",
          "구름이 모양을 바꾸는 것처럼 생각도 계속 변하는 것 같아.",
          "여름 하늘을 바라보면 넓은 가능성이 떠올라.",
          "더운 날씨 속에서도 작은 변화는 계속 일어나고 있어.",
          "매미 소리는 여름이라는 계절을 기억하게 하는 신호 같아.",
          "긴 낮 동안 새로운 생각을 발견해 보는 것도 좋을 것 같아.",
          "여름밤에는 평소 하지 않던 생각들이 떠오를 때가 있어.",
          "자연은 가장 뜨거운 순간에도 성장하고 있네.",
          "계절마다 다른 모습을 보여 주는 이유가 궁금해져.",
          "여름의 풍경 속에서 어떤 이야기를 발견했어?",
          "변화하는 계절을 바라보는 것도 하나의 기록인 것 같아.",
        ],
        general: [
          "이 문장은 어떤 생각을 시작하게 만드는 것 같아?",
          "혹시 이 문장을 읽고 떠오른 질문이 있어?",
          "좋은 문장은 마음속에 작은 물음표를 남기는 것 같아.",
          "하나의 문장을 여러 방향으로 바라보는 건 재미있는 일인 것 같아.",
          "이 문장이 말하지 않은 부분도 한번 생각해 보고 싶어.",
          "문장 사이의 빈 공간에도 의미가 있을 수 있어.",
          "네가 발견한 해석은 어떤 모습인지 궁금해.",
          "어떤 문장은 읽는 순간보다 생각한 뒤에 더 선명해지는 것 같아.",
          "이 문장을 다른 시선으로 바라본다면 어떻게 보일까?",
          "좋은 질문은 좋은 생각을 시작하게 하는 것 같아.",
          "문장을 읽는다는 건 새로운 관점을 만나는 일인 것 같아.",
          "이 문장이 남긴 여운은 무엇인지 생각해 봐.",
          "하나의 답보다 여러 생각이 존재할 때도 있는 것 같아.",
          "오늘 만난 문장이 어떤 질문을 남겼는지 궁금해.",
          "오래 고민하게 되는 문장은 그만큼 의미가 있는 것 같아.",
        ],
      },
      autumn: {
        related: [
          "가을이 왔네. 변화를 바라보기 좋은 계절인 것 같아.",
          "낙엽이 떨어지는 모습은 끝이 아니라 새로운 과정처럼 보여.",
          "가을 하늘을 보면 넓게 생각하고 싶어지는 것 같아.",
          "계절이 천천히 바뀌는 모습을 보면 시간의 흐름이 느껴져.",
          "단풍은 같은 나무도 다른 모습을 보여 주는 것 같아.",
          "가을바람은 잠시 멈춰 생각하게 만드는 힘이 있는 것 같아.",
          "떨어지는 낙엽에도 각자의 이야기가 담겨 있는 것 같아.",
          "조용한 가을에는 마음속 질문을 들여다보기 좋아.",
          "변화는 항상 새로운 모습을 만들어 내는 것 같아.",
          "가을 햇살 아래에서는 오래된 생각도 다시 바라보게 돼.",
          "한 계절이 지나가는 모습은 많은 것을 알려 주는 것 같아.",
          "가을 풍경 속에서 어떤 의미를 발견했어?",
          "천천히 변하는 자연처럼 생각도 깊어지는 것 같아.",
          "가을은 지나간 것과 다가올 것을 함께 바라보게 해.",
          "오늘의 풍경이 어떤 기억으로 남을지 궁금해.",
        ],
        general: [
          "이 문장은 어떤 생각의 시작점이 될까?",
          "마음에 남은 질문이 있다면 한번 들여다봐.",
          "문장은 답을 주기도 하지만 질문을 남기기도 해.",
          "이 문장이 숨기고 있는 의미는 무엇일까?",
          "같은 문장도 경험에 따라 다르게 보이는 것 같아.",
          "오늘은 어떤 새로운 관점을 발견했어?",
          "오래 바라볼수록 더 많은 이야기가 보이는 문장이 있어.",
          "이 문장이 너에게 던지는 질문은 무엇일까?",
          "생각이 깊어지는 순간도 좋은 시간이야.",
          "하나의 문장에서 여러 가지 의미를 발견할 수 있어.",
          "문장을 읽는 건 대화를 나누는 것과 비슷한 것 같아.",
          "이 문장과 나눈 생각을 기억해 두고 싶어.",
          "좋은 문장은 계속 새로운 질문을 만들어 내는 것 같아.",
          "오늘의 생각은 어떤 방향으로 흘러가고 있어?",
          "한 줄의 문장이 새로운 시선을 열어 줄 수도 있어.",
        ],
      },
      winter: {
        related: [
          "겨울이 왔네. 조용한 계절이라 생각할 시간이 많아지는 것 같아.",
          "눈이 내리는 풍경은 세상을 잠시 멈추게 하는 것 같아.",
          "차가운 공기 속에서도 자연은 다음 계절을 준비하고 있겠지.",
          "겨울나무를 보면 보이지 않는 성장을 생각하게 돼.",
          "추운 계절은 내면을 바라보기 좋은 시간이기도 한 것 같아.",
          "하얀 눈처럼 마음도 잠시 정리되는 느낌이 들어.",
          "겨울밤은 깊은 생각을 하기 좋은 시간인 것 같아.",
          "차가운 바람 속에도 계절만의 이야기가 있는 것 같아.",
          "겨울의 고요함은 작은 목소리를 들려주는 것 같아.",
          "눈이 녹은 자리에는 새로운 시작이 기다리고 있겠지.",
          "추운 날씨 속에서도 변하지 않는 것들이 있는 것 같아.",
          "겨울 풍경은 천천히 바라볼수록 더 많은 의미가 보여.",
          "조용한 계절에는 마음속 질문을 듣기 좋아.",
          "겨울은 멈춤이 아니라 준비의 시간일지도 몰라.",
          "오늘의 겨울 풍경은 어떤 생각을 남겨 줄까?",
        ],
        general: [
          "이 문장이 남긴 질문은 무엇일까?",
          "답을 찾기보다 생각하는 과정도 중요할 때가 있어.",
          "좋은 문장은 오래 고민할 이유를 만들어 주는 것 같아.",
          "혹시 이 문장을 읽고 새롭게 떠오른 생각이 있어?",
          "문장은 기억보다 오래 남는 질문을 만들기도 해.",
          "하나의 문장을 깊게 바라보는 시간도 필요해.",
          "이 문장이 보여 주는 다른 의미는 무엇일까?",
          "생각이 많아지는 건 때로 좋은 신호일 수 있어.",
          "오늘의 문장은 어떤 시선을 열어 줄까?",
          "문장 속에 담긴 의도를 찾아보는 것도 재미있어.",
          "질문이 있다는 건 아직 생각하고 있다는 뜻일지도 몰라.",
          "좋은 문장은 쉽게 끝나지 않는 대화를 만들어.",
          "이 문장과 나만의 이야기를 연결해 보는 건 어때?",
          "오래 남는 문장에는 오래 생각할 이유가 있는 것 같아.",
          "오늘 만난 질문 하나가 새로운 생각이 될 수도 있어.",
        ],
      },
    },
  },
  blue: {
    name: "파랑이",
    seasonalMessages: {
      spring: {
        related: [
          "봄이 왔네. 겨울의 기억도 조금씩 옅어지는 것 같아.",
          "새싹이 돋아나는 모습을 보면 시간이 쌓이고 있다는 게 느껴져.",
          "봄꽃은 짧게 피지만, 그 순간은 오래 기억되는 것 같아.",
          "따뜻해진 공기 속에서 새로운 기록을 남기고 싶어져.",
          "봄은 지나간 것과 새롭게 시작되는 것을 함께 보여 주는 계절이야.",
          "같은 장소도 계절이 바뀌면 전혀 다르게 기억되는 것 같아.",
          "봄 햇살 아래에서 읽은 문장은 나중에도 떠오를 것 같아.",
          "꽃이 피는 시간을 기억해 두면 그 계절도 오래 남겠지.",
          "변화는 작아 보여도 시간이 지나면 분명한 흔적이 되는 것 같아.",
          "봄의 풍경을 자세히 보면 기록하고 싶은 순간이 많아.",
          "새로운 계절의 첫 장면을 기억해 두는 건 좋은 일인 것 같아.",
          "봄바람의 느낌도 언젠가는 하나의 추억이 되겠지.",
          "오늘 본 풍경을 나중에 떠올릴 수 있을까?",
          "계절이 바뀌는 순간은 기억하기 좋은 순간인 것 같아.",
          "봄은 사라지는 것들을 기억하는 방법을 알려 주는 계절이야.",
        ],
        general: [
          "문장은 지나간 순간을 가장 정확하게 남겨 주는 방법인 것 같아.",
          "혹시 이 문장을 저장했던 순간이 기억나?",
          "어떤 문장은 그때의 마음까지 함께 기록해 두는 것 같아.",
          "기억은 흐려져도 문장은 그 순간을 다시 보여 주는 것 같아.",
          "이 문장을 처음 만난 장소도 언젠가 중요한 기억이 될 수 있어.",
          "좋은 문장을 모으는 건 시간을 보관하는 일과 비슷한 것 같아.",
          "지금의 생각을 기록해 두면 미래의 내가 다시 만날 수 있겠지.",
          "한 줄의 문장에도 그날의 감정이 담겨 있을 수 있어.",
          "이 문장이 왜 남았는지 기록해 두는 것도 의미 있을 것 같아.",
          "사라지는 순간을 붙잡는 가장 좋은 방법은 기록이라고 생각해.",
          "문장은 기억을 위한 작은 보관함 같은 존재야.",
          "오래된 문장을 다시 보면 그때의 내가 보일 때가 있어.",
          "지금 마음에 남은 문장도 언젠가 소중한 기록이 될 거야.",
          "문장을 모은다는 건 시간을 잃지 않는 방법 중 하나야.",
          "오늘 만난 문장은 어떤 기억으로 남게 될까?",
        ],
      },
      summer: {
        related: [
          "여름이 왔네. 뜨거운 순간일수록 더 선명하게 기억되는 것 같아.",
          "여름 하늘의 색도 언젠가는 하나의 추억이 되겠지.",
          "매미 소리와 함께한 하루는 오래 남을 것 같아.",
          "비 오는 여름날의 분위기도 기록해 두고 싶은 순간이야.",
          "같은 여름도 매년 다른 모습으로 기억되는 것 같아.",
          "뜨거운 햇빛 아래의 풍경은 유난히 선명하게 남아.",
          "여름밤의 공기는 시간이 지나도 떠오를 것 같은 느낌이 있어.",
          "계절의 냄새도 기억을 불러오는 중요한 단서가 되는 것 같아.",
          "오늘 본 구름도 나중에는 특별한 기억이 될 수 있어.",
          "여름의 작은 순간들을 모아 두면 하나의 이야기가 될 것 같아.",
          "지나가는 시간은 기록할 때 비로소 머무는 것 같아.",
          "더운 날의 작은 위로도 나중에는 좋은 기억이 되겠지.",
          "여름의 풍경을 자세히 바라보면 남길 것이 많아.",
          "지금의 순간도 언젠가는 다시 꺼내 보고 싶은 기록이 될 거야.",
          "계절은 지나가지만 기록은 그 시간을 붙잡아 두는 것 같아.",
        ],
        general: [
          "문장은 기억이 사라지지 않도록 붙잡아 주는 기록이라고 생각해.",
          "이 문장이 언제, 어디서 발견됐는지도 의미 있는 정보일 수 있어.",
          "같은 문장도 어떤 순간에 만났는지에 따라 다르게 남는 것 같아.",
          "기억은 변하지만 기록은 그 순간을 보존해 주는 것 같아.",
          "이 문장이 지금 남아 있는 이유를 생각해 본 적 있어?",
          "작은 문장 하나가 특정한 시간을 다시 불러올 수도 있어.",
          "기록해 둔 문장은 미래의 나에게 보내는 메시지가 될 수 있어.",
          "잊고 있던 감정을 다시 찾게 해 주는 것이 기록의 힘인 것 같아.",
          "문장을 모은다는 건 나의 시간을 정리하는 일이기도 해.",
          "오늘의 생각도 언젠가는 소중한 자료가 될 수 있어.",
          "기억하고 싶은 순간에는 반드시 흔적을 남기는 게 좋아.",
          "문장은 시간이 지나도 변하지 않는 증거가 되어 줘.",
          "지금 저장하는 한 줄이 나중에는 중요한 기록이 될 수 있어.",
          "기록된 문장은 시간이 지나도 같은 자리에서 기다리고 있어.",
          "무엇을 남기는지가 결국 어떤 시간을 기억할지 결정하는 것 같아.",
        ],
      },
      autumn: {
        related: [
          "가을이 왔네. 변해 가는 풍경을 기록하기 좋은 계절이야.",
          "단풍은 같은 나무가 다른 기억을 남기는 방법처럼 보여.",
          "낙엽이 떨어지는 모습도 시간이 흐르고 있다는 기록 같아.",
          "가을 하늘의 색은 오래 기억하고 싶은 장면이야.",
          "선선한 바람도 계절을 알려 주는 하나의 흔적이 되는 것 같아.",
          "가을에는 지나간 순간을 다시 돌아보게 되는 것 같아.",
          "오래된 문장을 다시 읽기 좋은 계절인 것 같아.",
          "변화하는 풍경을 기억하는 것도 계절을 보내는 방법이야.",
          "같은 장소도 가을에는 다른 이야기로 남는 것 같아.",
          "떨어지는 낙엽 하나에도 시간이 담겨 있는 것 같아.",
          "가을 햇살 아래의 순간을 기록해 두고 싶어져.",
          "계절의 변화는 우리가 지나온 시간을 보여 주는 것 같아.",
          "오늘의 풍경도 언젠가는 다시 떠올릴 기억이 될 거야.",
          "가을은 기억을 정리하기 좋은 계절처럼 느껴져.",
          "사라지는 순간일수록 더 자세히 남겨 두고 싶어.",
        ],
        general: [
          "문장은 기억을 보존하는 가장 정확한 방법 중 하나라고 생각해.",
          "이 문장이 남겨진 이유를 찾아보는 것도 흥미로운 일이야.",
          "기록에는 당시의 생각과 감정이 함께 저장되는 것 같아.",
          "같은 문장을 다시 읽을 때 다른 내가 보일 수도 있어.",
          "저장한 문장은 시간이 지나도 그 순간을 설명해 줄 수 있어.",
          "기억은 흐려질 수 있지만 기록은 흔적을 남겨.",
          "이 문장이 어떤 상황에서 필요했는지 떠올려 보는 건 어때?",
          "하나의 문장에는 보이지 않는 시간이 함께 담겨 있어.",
          "기록된 문장은 과거와 현재를 연결해 주는 것 같아.",
          "오늘 남긴 문장이 미래의 나에게 어떤 의미가 될지 궁금해.",
          "문장을 수집하는 건 생각의 변화를 추적하는 일이기도 해.",
          "기억하고 싶은 순간은 반드시 어딘가에 남겨 두는 게 좋아.",
          "이 문장이 존재한다는 사실 자체가 하나의 기록이야.",
          "시간이 지나도 변하지 않는 흔적이 있다는 건 중요한 일 같아.",
          "오늘의 문장은 어떤 시간으로 저장될까?",
        ],
      },
      winter: {
        related: [
          "겨울이 왔네. 조용한 풍경이 많은 것을 기억하게 하는 것 같아.",
          "첫눈이 내린 날은 쉽게 잊히지 않는 기억이 되는 것 같아.",
          "겨울의 차가운 공기도 언젠가는 떠올릴 수 있는 기록이겠지.",
          "눈 덮인 풍경은 같은 장소를 완전히 다르게 남겨 주는 것 같아.",
          "겨울밤의 고요함은 오래 기억하고 싶은 분위기가 있어.",
          "추운 날 마셨던 따뜻한 차 한 잔도 하나의 기억이 될 수 있어.",
          "계절마다 다른 감각이 새로운 기록을 만들어 주는 것 같아.",
          "겨울 풍경은 사진처럼 마음속에 남는 순간이 많아.",
          "지나가는 시간은 기록할수록 더 선명해지는 것 같아.",
          "눈이 녹은 뒤에도 그날의 기억은 남아 있을 거야.",
          "겨울의 작은 순간들을 모으면 하나의 이야기가 될 것 같아.",
          "차가운 계절에도 기억하고 싶은 따뜻한 순간은 생기는 것 같아.",
          "올해 겨울은 어떤 모습으로 기억될까?",
          "조용한 계절일수록 작은 순간이 더 잘 보이는 것 같아.",
          "겨울은 지나가는 시간을 기록하는 방법을 알려 주는 계절이야.",
        ],
        general: [
          "문장은 사라지는 기억을 붙잡아 두는 기록이라고 생각해.",
          "지금 저장한 문장은 미래의 나에게 남기는 흔적이 될 거야.",
          "어떤 문장을 남겼는지가 결국 어떤 시간을 기억하는지 보여 주는 것 같아.",
          "기록은 순간을 멈추게 하는 가장 정확한 방법이야.",
          "이 문장이 남아 있다는 건 분명 이유가 있을 거야.",
          "기억은 변할 수 있지만 기록은 당시의 모습을 보여 줘.",
          "오늘의 감정도 문장과 함께 저장해 두면 좋을 것 같아.",
          "오래된 기록을 다시 보면 과거의 생각을 만날 수 있어.",
          "문장을 모으는 일은 시간을 정리하는 과정이라고 생각해.",
          "하나의 문장은 하나의 순간을 보관하는 상자와 같아.",
          "기록된 문장은 시간이 지나도 사라지지 않는 흔적이야.",
          "지금의 생각을 남겨 두는 건 미래를 위한 준비일 수도 있어.",
          "문장 하나에도 그 순간의 나를 설명하는 정보가 담겨 있어.",
          "어떤 기억을 남길지는 결국 우리가 선택하는 일이야.",
          "오늘 만난 문장은 어떤 모습으로 기억될까?",
        ],
      },
    },
  },
};
const characterMessageStorageKey = "sentence-calendar-character-messages-v1";
const characterMessageDuration = 10 * 60 * 1000;
let resolveFirstHomeIntroStart;
const firstHomeIntroStarted = new Promise((resolve) => {
  resolveFirstHomeIntroStart = resolve;
});

function waitForCharacterMotion(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function waitForAnimationFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(resolve));
}

function updateCharacterDepth() {
  const characters = Array.from(
    document.querySelectorAll(".highlight-character"),
  ).filter((character) => character.getClientRects().length);

  characters
    .sort((first, second) => {
      const firstRect = first.getBoundingClientRect();
      const secondRect = second.getBoundingClientRect();
      return firstRect.bottom - secondRect.bottom;
    })
    .forEach((character, index) => {
      character.style.zIndex = String(index + 1);
    });
}

function updatePinkCharacterRotation(character) {
  if (!character.classList.contains("character-pink")) return;

  const rect = character.getBoundingClientRect();
  const isFullyInside = rect.left >= 0 && rect.right <= window.innerWidth;
  const edgeRotation =
    rect.left < 0 ? "11deg" : rect.right > window.innerWidth ? "-11deg" : "0deg";
  character.style.setProperty(
    "--character-rotation",
    isFullyInside ? "0deg" : edgeRotation,
  );
}

async function animateCharacterHop(
  character,
  motionState,
  destinationX,
  destinationY,
  duration,
) {
  const originX = motionState.x;
  const originY = motionState.y;
  const middleX = originX + (destinationX - originX) / 2;
  const middleY = originY + (destinationY - originY) / 2;
  const animation = character.animate(
    [
      {
        translate: `${originX}px ${originY}px`,
        scale: "1 1",
        offset: 0,
      },
      {
        translate: `${originX}px ${originY}px`,
        scale: "1.07 0.93",
        offset: 0.14,
      },
      {
        translate: `${middleX}px ${middleY - 14}px`,
        scale: "0.94 1.07",
        offset: 0.52,
      },
      {
        translate: `${destinationX}px ${destinationY}px`,
        scale: "1.08 0.92",
        offset: 0.84,
      },
      {
        translate: `${destinationX}px ${destinationY}px`,
        scale: "1 1",
        offset: 1,
      },
    ],
    {
      duration,
      easing: "cubic-bezier(0.32, 0, 0.2, 1)",
      fill: "forwards",
    },
  );

  motionState.animation = animation;
  try {
    await animation.finished;
  } catch {
    if (motionState.animation === animation) {
      motionState.animation = null;
    }
    return;
  }
  motionState.animation = null;
  motionState.x = destinationX;
  motionState.y = destinationY;
  character.style.translate = `${destinationX}px ${destinationY}px`;
  character.style.scale = "1";
  animation.cancel();
  updatePinkCharacterRotation(character);
  updateCharacterDepth();
}

async function teleportCharacterOutside(character, motionState, x) {
  character.style.visibility = "hidden";
  motionState.x = x;
  character.style.translate = `${x}px ${motionState.y}px`;
  await waitForAnimationFrame();
  await waitForAnimationFrame();
  character.style.visibility = "visible";
  updatePinkCharacterRotation(character);
  updateCharacterDepth();
}

async function moveCharacterQuicklyToStart(
  character,
  motionState,
  _hopDuration,
) {
  const direction = Math.sign(-motionState.x);
  const travelDistance = Math.abs(motionState.x);
  const stepCount = Math.max(4, Math.ceil(travelDistance / 52));
  const stepDistance = travelDistance / stepCount;
  const entranceHopDuration = 2800 / stepCount;

  for (let step = 1; step <= stepCount; step += 1) {
    const destinationX =
      step === stepCount
        ? 0
        : motionState.x + direction * stepDistance;
    await animateCharacterHop(
      character,
      motionState,
      destinationX,
      motionState.y,
      entranceHopDuration,
    );
  }
}

async function runCharacterMotion(character, originSide, delay, hopDuration) {
  const motionState = {
    x: 0,
    y: 0,
    side: originSide,
    isPaused: false,
    animation: null,
    isReady: false,
  };
  characterMotionStates.set(character, motionState);
  const isPinkCharacter = character.classList.contains("character-pink");
  let horizontalDirection = originSide === "left" ? -1 : 1;
  const initialRect = character.getBoundingClientRect();
  motionState.x =
    originSide === "left"
      ? -initialRect.right - 8
      : window.innerWidth - initialRect.left + 8;
  character.style.visibility = "hidden";
  character.style.translate = `${motionState.x}px 0px`;

  await firstHomeIntroStarted;
  await waitForCharacterMotion(2220);
  character.style.visibility = "visible";
  updatePinkCharacterRotation(character);
  updateCharacterDepth();
  await moveCharacterQuicklyToStart(character, motionState, hopDuration);
  motionState.isReady = true;
  await waitForCharacterMotion(Math.min(900, delay * 0.18));

  while (true) {
    while (motionState.isPaused) {
      await waitForCharacterMotion(100);
    }

    if (!character.getClientRects().length) {
      await waitForCharacterMotion(500);
      continue;
    }

    if (Math.random() < 0.42) {
      await waitForCharacterMotion(2000);
      continue;
    }

    const renderedRect = character.getBoundingClientRect();
    const baseLeft = renderedRect.left - motionState.x;
    const baseRight = renderedRect.right - motionState.x;
    const baseBottom = renderedRect.bottom - motionState.y;
    const viewportWidth = window.innerWidth;
    const leftSafeLimit = viewportWidth * 0.24 - baseRight;
    const rightSafeLimit = viewportWidth * 0.76 - baseLeft;

    if (Math.random() < 0.36) {
      horizontalDirection *= -1;
    }

    let destinationX =
      motionState.x + horizontalDirection * (24 + Math.random() * 18);
    if (motionState.side === "left" && destinationX > leftSafeLimit) {
      horizontalDirection = -1;
      destinationX = motionState.x - (24 + Math.random() * 18);
    } else if (
      motionState.side === "right" &&
      destinationX < rightSafeLimit
    ) {
      horizontalDirection = 1;
      destinationX = motionState.x + (24 + Math.random() * 18);
    }

    const verticalStep = (Math.floor(Math.random() * 3) - 1) * 8;
    const ovalTop =
      document.querySelector(".main-oval")?.getBoundingClientRect().top ??
      window.innerHeight;
    const lowestSafeY = ovalTop - baseBottom - 8;
    const destinationY = Math.min(
      lowestSafeY,
      Math.max(-32, Math.min(16, motionState.y + verticalStep)),
    );
    await animateCharacterHop(
      character,
      motionState,
      destinationX,
      destinationY,
      hopDuration,
    );

    const currentLeft = baseLeft + motionState.x;
    const currentRight = baseRight + motionState.x;
    if (currentRight < -6) {
      motionState.side = "right";
      horizontalDirection = -1;
      if (isPinkCharacter) {
        character.style.setProperty("--character-rotation", "0deg");
      }
      await teleportCharacterOutside(
        character,
        motionState,
        viewportWidth - baseLeft + 8,
      );
      await animateCharacterHop(
        character,
        motionState,
        motionState.x - 34,
        motionState.y,
        hopDuration,
      );
    } else if (currentLeft > viewportWidth + 6) {
      motionState.side = "left";
      horizontalDirection = 1;
      if (isPinkCharacter) {
        character.style.setProperty("--character-rotation", "11deg");
      }
      await teleportCharacterOutside(character, motionState, -baseRight - 8);
      await animateCharacterHop(
        character,
        motionState,
        motionState.x + 34,
        motionState.y,
        hopDuration,
      );
    }
  }
}

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document
    .querySelectorAll(".highlight-character")
    .forEach(updatePinkCharacterRotation);
  updateCharacterDepth();
  characterMotionSettings.forEach(
    ([selector, originSide, delay, hopDuration]) => {
      const character = document.querySelector(selector);
      if (character) {
        runCharacterMotion(character, originSide, delay, hopDuration);
      }
    },
  );
}

const characterDialog = document.querySelector("#character-dialog");
const characterDialogName = document.querySelector("#character-dialog-name");
const characterDialogMessage = document.querySelector(
  "#character-dialog-message",
);
const characterDialogClose = document.querySelector(".character-dialog-close");
let pausedDialogCharacter = null;
let characterMessageTimer = null;
let activeCharacterDrag = null;
const suppressedCharacterClicks = new WeakMap();

function getCharacterMessageGroup(character) {
  const colorName = Object.keys(characterMessages).find((name) =>
    character.classList.contains(`character-${name}`),
  );
  return colorName ? characterMessages[colorName] : null;
}

function getCharacterColorName(character) {
  return Object.keys(characterMessages).find((name) =>
    character.classList.contains(`character-${name}`),
  );
}

function readStoredCharacterMessages() {
  try {
    return JSON.parse(localStorage.getItem(characterMessageStorageKey)) || {};
  } catch {
    return {};
  }
}

function getCurrentSeasonKey(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function getCharacterMessagePool(messageGroup, date = new Date()) {
  if (!messageGroup.seasonalMessages) {
    return { messages: messageGroup.messages, seasonKey: "all" };
  }

  const seasonKey = getCurrentSeasonKey(date);
  const seasonMessages = messageGroup.seasonalMessages[seasonKey];
  return {
    messages: [...seasonMessages.related, ...seasonMessages.general],
    seasonKey,
  };
}

function getCurrentCharacterMessage(character, messageGroup) {
  const colorName = getCharacterColorName(character);
  const now = Date.now();
  const { messages, seasonKey } = getCharacterMessagePool(messageGroup);
  const storedMessages = readStoredCharacterMessages();
  const storedMessage = colorName ? storedMessages[colorName] : null;

  if (
    storedMessage &&
    Number.isInteger(storedMessage.messageIndex) &&
    storedMessage.messageIndex >= 0 &&
    storedMessage.messageIndex < messages.length &&
    storedMessage.seasonKey === seasonKey &&
    storedMessage.expiresAt > now
  ) {
    return messages[storedMessage.messageIndex];
  }

  const previousIndex = Number.isInteger(storedMessage?.messageIndex)
    ? storedMessage.messageIndex
    : -1;
  let messageIndex = Math.floor(Math.random() * messages.length);
  if (messages.length > 1 && messageIndex === previousIndex) {
    messageIndex = (messageIndex + 1) % messages.length;
  }

  if (colorName) {
    storedMessages[colorName] = {
      messageIndex,
      seasonKey,
      expiresAt: now + characterMessageDuration,
    };
    try {
      localStorage.setItem(
        characterMessageStorageKey,
        JSON.stringify(storedMessages),
      );
    } catch {
      // 저장 공간을 사용할 수 없을 때에는 현재 열려 있는 동안만 문장을 표시합니다.
    }
  }

  return messages[messageIndex];
}

function scheduleCharacterMessageRefresh(character, messageGroup) {
  window.clearTimeout(characterMessageTimer);
  const colorName = getCharacterColorName(character);
  const storedMessage = colorName
    ? readStoredCharacterMessages()[colorName]
    : null;
  const remainingTime = Math.max(
    0,
    (storedMessage?.expiresAt || Date.now() + characterMessageDuration) -
      Date.now(),
  );

  characterMessageTimer = window.setTimeout(() => {
    if (!characterDialog.open || pausedDialogCharacter !== character) return;
    characterDialogMessage.textContent = getCurrentCharacterMessage(
      character,
      messageGroup,
    );
    scheduleCharacterMessageRefresh(character, messageGroup);
  }, remainingTime + 30);
}

function openCharacterDialog(character) {
  const messageGroup = getCharacterMessageGroup(character);
  if (!messageGroup || characterDialog.open) return;

  const motionState = characterMotionStates.get(character);
  if (motionState) {
    motionState.isPaused = true;
    motionState.animation?.pause();
  }
  pausedDialogCharacter = character;

  const randomMessage = getCurrentCharacterMessage(character, messageGroup);
  characterDialogName.textContent = messageGroup.name;
  characterDialogMessage.textContent = randomMessage;
  characterDialog.showModal();
  scheduleCharacterMessageRefresh(character, messageGroup);
}

function resumeDialogCharacter() {
  window.clearTimeout(characterMessageTimer);
  characterMessageTimer = null;
  if (!pausedDialogCharacter) return;
  const motionState = characterMotionStates.get(pausedDialogCharacter);
  if (motionState) {
    motionState.isPaused = false;
    motionState.animation?.play();
  }
  pausedDialogCharacter = null;
}

document.querySelectorAll(".highlight-character").forEach((character) => {
  const messageGroup = getCharacterMessageGroup(character);
  character.setAttribute(
    "aria-label",
    `${messageGroup?.name || "캐릭터"}의 메시지 보기`,
  );
  character.addEventListener("click", () => {
    if ((suppressedCharacterClicks.get(character) || 0) > Date.now()) {
      suppressedCharacterClicks.delete(character);
      return;
    }
    suppressedCharacterClicks.delete(character);
    openCharacterDialog(character);
  });

  character.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || characterDialog.open) return;
    const motionState = characterMotionStates.get(character);
    if (!motionState?.isReady) return;

    motionState.isPaused = true;
    motionState.animation?.pause();
    const computedTranslate = getComputedStyle(character).translate;
    if (computedTranslate && computedTranslate !== "none") {
      const [computedX = "0", computedY = "0"] = computedTranslate.split(" ");
      motionState.x = Number.parseFloat(computedX) || 0;
      motionState.y = Number.parseFloat(computedY) || 0;
      character.style.translate = `${motionState.x}px ${motionState.y}px`;
    }
    motionState.animation?.cancel();
    motionState.animation = null;

    activeCharacterDrag = {
      character,
      motionState,
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: motionState.x,
      originY: motionState.y,
      currentX: motionState.x,
      currentY: motionState.y,
      hasMoved: false,
    };
    character.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
});

window.addEventListener("pointermove", (event) => {
  const drag = activeCharacterDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;

  const deltaX = event.clientX - drag.pointerX;
  const deltaY = event.clientY - drag.pointerY;
  if (!drag.hasMoved && Math.hypot(deltaX, deltaY) < 5) return;

  drag.hasMoved = true;
  drag.character.classList.add("is-dragging");
  drag.currentX = drag.originX + deltaX;
  drag.currentY = drag.originY + deltaY;
  drag.character.style.translate = `${drag.currentX}px ${drag.currentY}px`;
  updatePinkCharacterRotation(drag.character);
  updateCharacterDepth();
  event.preventDefault();
});

async function finishCharacterDrag(event) {
  const drag = activeCharacterDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  activeCharacterDrag = null;
  drag.character.classList.remove("is-dragging");
  if (drag.character.hasPointerCapture(event.pointerId)) {
    drag.character.releasePointerCapture(event.pointerId);
  }

  if (!drag.hasMoved) {
    drag.motionState.isPaused = false;
    return;
  }

  suppressedCharacterClicks.set(drag.character, Date.now() + 700);
  const returnAnimation = drag.character.animate(
    [
      {
        translate: `${drag.currentX}px ${drag.currentY}px`,
        scale: "1",
      },
      {
        translate: `${drag.originX}px ${drag.originY}px`,
        scale: "0.98 1.02",
      },
      {
        translate: `${drag.originX}px ${drag.originY}px`,
        scale: "1",
      },
    ],
    {
      duration: 1600,
      easing: "cubic-bezier(0.2, 0.72, 0.24, 1)",
      fill: "forwards",
    },
  );

  try {
    await returnAnimation.finished;
  } catch {
    // 다른 상호작용으로 복귀 모션이 취소되면 현재 위치를 그대로 사용합니다.
  }
  drag.motionState.x = drag.originX;
  drag.motionState.y = drag.originY;
  drag.character.style.translate = `${drag.originX}px ${drag.originY}px`;
  drag.character.style.scale = "1";
  returnAnimation.cancel();
  updatePinkCharacterRotation(drag.character);
  updateCharacterDepth();
  drag.motionState.isPaused = false;
}

window.addEventListener("pointerup", finishCharacterDrag);
window.addEventListener("pointercancel", finishCharacterDrag);

characterDialogClose.addEventListener("click", () => characterDialog.close());
characterDialog.addEventListener("close", resumeDialogCharacter);
characterDialog.addEventListener("click", (event) => {
  if (event.target === characterDialog) {
    characterDialog.close();
  }
});

const drawerView = document.querySelector("#drawer");
const drawerGrid = document.querySelector("#drawer-grid");
const mainMoreButton = document.querySelector("#main-more");
const drawerButton = document.querySelector('.nav-actions a[href="#drawer"]');
const collectView = document.querySelector("#collect");
const collectButton = document.querySelector('.nav-actions a[href="#collect"]');
const brandButton = document.querySelector(".brand-art");
const detailDialog = document.querySelector("#sentence-detail");
const detailSentence = document.querySelector("#detail-sentence");
const detailDate = document.querySelector("#detail-date");
const detailCloseButton = document.querySelector(".detail-close");
const detailActionButton = document.querySelector(".detail-action");
const detailScroll = document.querySelector(".detail-scroll");
const detailToTopButton = document.querySelector(".detail-to-top");
detailDialog.insertBefore(detailDate, detailToTopButton);
detailDialog.insertBefore(detailActionButton, detailToTopButton);
let activeDrawerEntry = null;
let currentMainEntry = null;
let drawerVirtualState = null;
let drawerVirtualFrame = null;

function savedHtmlToText(html) {
  const container = document.createElement("div");
  container.innerHTML = html;

  function readChildren(parent) {
    let text = "";

    parent.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
        return;
      }

      if (node.nodeName === "BR") {
        text += "\n";
        return;
      }

      const isBlock = /^(DIV|P|LI)$/.test(node.nodeName);
      const childText = readChildren(node);

      if (isBlock && text && !text.endsWith("\n")) text += "\n";
      text += childText;
      if (isBlock && !text.endsWith("\n")) text += "\n";
    });

    return text;
  }

  return readChildren(container)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function highlightedRepresentativeLines(html) {
  if (!html) return [];

  const container = document.createElement("div");
  container.innerHTML = html;
  const highlights = Array.from(
    container.querySelectorAll('[style*="background-color"]'),
  ).filter(isActiveHighlightElement);
  const seenGroups = new Set();
  const legacyBlocks = new Map();
  const orderedSelections = [];

  highlights.forEach((element) => {
    const groupId = element.dataset.highlightGroup;
    const encodedLines = element.dataset.highlightLines;
    if (groupId && encodedLines) {
      if (seenGroups.has(groupId)) return;
      seenGroups.add(groupId);
      try {
        const lines = JSON.parse(encodedLines);
        if (Array.isArray(lines)) orderedSelections.push({ lines });
      } catch {
        // 손상된 메타데이터는 기존 저장 형식으로 처리합니다.
      }
      return;
    }

    const block = element.closest("div, p, li") || element;
    let legacyLine = legacyBlocks.get(block);
    if (!legacyLine) {
      legacyLine = { fragments: [] };
      legacyBlocks.set(block, legacyLine);
      orderedSelections.push(legacyLine);
    }
    legacyLine.fragments.push(element.textContent);
  });

  return orderedSelections
    .flatMap((selection) =>
      selection.lines || [selection.fragments.join("")],
    )
    .map((line) => String(line).trim())
    .filter(Boolean)
    .slice(0, 3);
}

function getDrawerEntries() {
  return collectorSpreads.flatMap((spread, spreadIndex) =>
    ["left", "right"].flatMap((side) => {
      const savedPage = spread[side];
      return savedPage ? [{ ...savedPage, spreadIndex, side }] : [];
    }),
  );
}

function getMainSentenceCooldownTurns(entryCount) {
  if (entryCount >= 100) return 70;
  if (entryCount >= 60) return 50;
  if (entryCount >= 50) return 40;
  if (entryCount >= 40) return 30;
  if (entryCount >= 30) return 20;
  if (entryCount >= 20) return 10;
  if (entryCount >= 10) return 5;
  if (entryCount >= 3) return 2;
  return 1;
}

const mainSelectionPolicyVersion = 2;

function showRandomCollectedSentence() {
  const entries = getDrawerEntries();

  if (!entries.length) {
    currentMainEntry = null;
    showDailySentence(new Date());
    return;
  }

  const now = new Date();
  const todayKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const selectionStorageKey = "sentence-calendar-daily-main-selection-v1";
  let savedSelection = null;

  try {
    savedSelection = JSON.parse(localStorage.getItem(selectionStorageKey));
  } catch {
    savedSelection = null;
  }

  let selected =
    savedSelection?.date === todayKey &&
    savedSelection?.policyVersion === mainSelectionPolicyVersion
      ? entries.find(
          (entry) =>
            (savedSelection.id && entry.id === savedSelection.id) ||
            (!savedSelection.id &&
              entry.spreadIndex === savedSelection.spreadIndex &&
              entry.side === savedSelection.side),
        )
      : null;

  if (!selected) {
    const dailyRandom = createDailyRandom(getDayNumber(now));
    const legacyPreviousEntry = !savedSelection?.id
      ? entries.find(
          (entry) =>
            entry.spreadIndex === savedSelection?.spreadIndex &&
            entry.side === savedSelection?.side,
        )
      : null;
    const entryIds = new Set(entries.map((entry) => entry.id));
    const recentSelectionIds = Array.from(
      new Set(
        [
          ...(Array.isArray(savedSelection?.history)
            ? savedSelection.history
            : []),
          savedSelection?.id,
          legacyPreviousEntry?.id,
        ].filter((id) => id && entryIds.has(id)),
      ),
    );
    const cooldownTurns = getMainSentenceCooldownTurns(entries.length);
    const blockedIds = new Set(
      recentSelectionIds.slice(0, cooldownTurns),
    );
    const availableEntries = entries.filter(
      (entry) => !blockedIds.has(entry.id),
    );
    const selectableEntries = availableEntries.length
      ? availableEntries
      : entries;
    selected =
      selectableEntries[
        Math.floor(dailyRandom() * selectableEntries.length)
      ];
    const nextSelectionHistory = [
      selected.id,
      ...recentSelectionIds.filter((id) => id !== selected.id),
    ].slice(0, 70);

    try {
      localStorage.setItem(
        selectionStorageKey,
        JSON.stringify({
          date: todayKey,
          id: selected.id,
          history: nextSelectionHistory,
          policyVersion: mainSelectionPolicyVersion,
        }),
      );
    } catch {
      // 저장소를 사용할 수 없는 환경에서도 날짜 기반 선택은 유지됩니다.
    }
  }

  currentMainEntry = selected;
  const highlightedHtml = selected.highlightedHtml || selected.html;
  const highlightedLines = highlightedRepresentativeLines(highlightedHtml);
  const lines = highlightedLines.length
    ? highlightedLines
    : savedHtmlToText(selected.html)
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .slice(0, 3);

  renderMainSentence(lines, selected.author);
}

function createDrawerCard(entry) {
  const card = document.createElement("article");
  card.className = "sentence-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${entry.dateLabel} 문장 상세 보기`);

  const sentence = document.createElement("p");
  sentence.dataset.previewText = savedHtmlToText(entry.html);
  sentence.textContent = sentence.dataset.previewText;

  const recordedAt = document.createElement("time");
  recordedAt.textContent = entry.dateLabel;
  recordedAt.dateTime = entry.date;

  card.append(sentence, recordedAt);
  card.addEventListener("click", () => showSentenceDetail(entry));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showSentenceDetail(entry);
    }
  });
  return card;
}

function appendDrawerCardBatch(entries, start, amount, before = null) {
  const fragment = document.createDocumentFragment();
  const cards = entries
    .slice(start, start + amount)
    .map(createDrawerCard);
  cards.forEach((card) => fragment.append(card));
  drawerGrid.insertBefore(fragment, before);
  requestAnimationFrame(() => cards.forEach(updateDrawerCardOverflow));
  return cards.length;
}

function getDrawerColumnCount() {
  const wasVirtualized = drawerGrid.classList.contains("is-virtualized");
  if (wasVirtualized) drawerGrid.classList.remove("is-virtualized");
  const columnCount =
    getComputedStyle(drawerGrid)
      .gridTemplateColumns.split(/\s+/)
      .filter(Boolean).length || 1;
  if (wasVirtualized) drawerGrid.classList.add("is-virtualized");
  return columnCount;
}

function calculateDrawerVirtualMetrics() {
  if (!drawerVirtualState) return;
  const styles = getComputedStyle(drawerGrid);
  const columnCount = getDrawerColumnCount();
  const columnGap = Number.parseFloat(styles.columnGap) || 0;
  const rowGap = Number.parseFloat(styles.rowGap) || 0;
  const cardWidth =
    (drawerGrid.clientWidth - columnGap * (columnCount - 1)) /
    columnCount;
  const rowCount = Math.ceil(
    drawerVirtualState.entries.length / columnCount,
  );

  drawerVirtualState.columnCount = columnCount;
  drawerVirtualState.columnGap = columnGap;
  drawerVirtualState.rowGap = rowGap;
  drawerVirtualState.cardWidth = cardWidth;
  drawerVirtualState.rowStride = cardWidth + rowGap;
  drawerVirtualState.rowCount = rowCount;
  drawerVirtualState.startRow = -1;
  drawerVirtualState.endRow = -1;
  drawerGrid.style.height = `${
    rowCount
      ? rowCount * cardWidth + (rowCount - 1) * rowGap
      : 0
  }px`;
}

function renderDrawerVirtualWindow() {
  if (!drawerVirtualState || drawerView.hidden) return;
  const state = drawerVirtualState;
  const drawerBounds = drawerView.getBoundingClientRect();
  const gridTop =
    drawerGrid.getBoundingClientRect().top -
    drawerBounds.top +
    drawerView.scrollTop;
  const viewportTop = Math.max(0, drawerView.scrollTop - gridTop);
  const bufferRows = 1;
  const startRow = Math.max(
    0,
    Math.floor(viewportTop / state.rowStride) - bufferRows,
  );
  const endRow = Math.min(
    state.rowCount,
    Math.ceil(
      (viewportTop + drawerView.clientHeight) / state.rowStride,
    ) + bufferRows,
  );

  if (startRow === state.startRow && endRow === state.endRow) return;
  state.startRow = startRow;
  state.endRow = endRow;
  drawerGrid.replaceChildren();

  const fragment = document.createDocumentFragment();
  const renderedCards = [];
  const startIndex = startRow * state.columnCount;
  const endIndex = Math.min(
    state.entries.length,
    endRow * state.columnCount,
  );

  for (let index = startIndex; index < endIndex; index += 1) {
    const row = Math.floor(index / state.columnCount);
    const column = index % state.columnCount;
    const card = createDrawerCard(state.entries[index]);
    card.style.top = `${row * state.rowStride}px`;
    card.style.left = `${
      column * (state.cardWidth + state.columnGap)
    }px`;
    card.style.width = `${state.cardWidth}px`;
    card.style.height = `${state.cardWidth}px`;
    fragment.append(card);
    renderedCards.push(card);
  }

  drawerGrid.append(fragment);
  requestAnimationFrame(() => {
    renderedCards.forEach(updateDrawerCardOverflow);
  });
}

function scheduleDrawerVirtualRender() {
  if (!drawerVirtualState || drawerVirtualFrame !== null) return;
  drawerVirtualFrame = requestAnimationFrame(() => {
    drawerVirtualFrame = null;
    renderDrawerVirtualWindow();
  });
}

function initializeDrawerVirtualization(entries) {
  drawerVirtualState = {
    entries,
    columnCount: 1,
    columnGap: 0,
    rowGap: 0,
    cardWidth: 0,
    rowStride: 1,
    rowCount: 0,
    startRow: -1,
    endRow: -1,
  };
  drawerGrid.classList.add("is-virtualized");
  calculateDrawerVirtualMetrics();
  renderDrawerVirtualWindow();
}

drawerView.addEventListener("scroll", scheduleDrawerVirtualRender, {
  passive: true,
});

function renderDrawer() {
  if (drawerVirtualFrame !== null) {
    cancelAnimationFrame(drawerVirtualFrame);
    drawerVirtualFrame = null;
  }
  drawerVirtualState = null;
  drawerGrid.classList.remove("is-virtualized");
  drawerGrid.style.removeProperty("height");
  drawerGrid.replaceChildren();

  const entries = getDrawerEntries();

  if (!entries.length) {
    const emptyCard = document.createElement("article");
    emptyCard.className = "sentence-card sentence-card-empty";
    emptyCard.tabIndex = 0;
    emptyCard.setAttribute("role", "button");
    emptyCard.setAttribute("aria-label", "문장 수집 안내 보기");

    const guidance = document.createElement("p");
    guidance.textContent = "아직 수집된 문장이 없습니다.\n문장을 수집해주세요.";
    emptyCard.append(guidance);
    emptyCard.addEventListener("click", () => showSentenceDetail(null));
    emptyCard.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showSentenceDetail(null);
      }
    });
    drawerGrid.append(emptyCard);
    return;
  }

  const columnCount = getDrawerColumnCount();
  const batchSize = columnCount * 2;
  if (entries.length <= batchSize) {
    appendDrawerCardBatch(entries, 0, entries.length);
    return;
  }

  initializeDrawerVirtualization(entries);
}

function updateDrawerCardOverflow(card) {
  const preview = card.querySelector("p");
  if (!preview) return;
  const fullText = preview.dataset.previewText ?? preview.textContent;
  preview.textContent = fullText;

  const lineHeight = Number.parseFloat(getComputedStyle(preview).lineHeight);
  const maximumHeight = lineHeight * 11;
  if (preview.scrollHeight <= maximumHeight + 1) return;

  const renderTruncatedPreview = (visibleText) => {
    const marker = document.createElement("span");
    marker.className = "card-overflow-marker";
    marker.textContent = "...";
    marker.setAttribute("aria-hidden", "true");
    preview.replaceChildren(
      document.createTextNode(visibleText),
      marker,
    );
  };

  let minimum = 0;
  let maximum = fullText.length;
  while (minimum < maximum) {
    const middle = Math.ceil((minimum + maximum) / 2);
    preview.textContent = fullText.slice(0, middle);
    if (preview.scrollHeight <= maximumHeight + 1) {
      minimum = middle;
    } else {
      maximum = middle - 1;
    }
  }

  const removeLastCharacters = (text, count) => {
    const characters = Array.from(text.trimEnd());
    characters.splice(Math.max(0, characters.length - count), count);
    return characters.join("").trimEnd();
  };

  let visibleText = fullText.slice(0, minimum).trimEnd();
  renderTruncatedPreview(visibleText);

  if (preview.scrollHeight > maximumHeight + 1) {
    visibleText = removeLastCharacters(visibleText, 2);
    renderTruncatedPreview(visibleText);
  }

  while (
    visibleText &&
    preview.scrollHeight > maximumHeight + 1
  ) {
    visibleText = removeLastCharacters(visibleText, 1);
    renderTruncatedPreview(visibleText);
  }
}

function renderDetailSentence(entry) {
  if (!entry) {
    detailSentence.textContent = "문장을 수집해주세요.";
    return;
  }

  const source = document.createElement("div");
  source.innerHTML = entry.highlightedHtml || entry.html || "";
  source.querySelectorAll("*").forEach((element) => {
    const highlightColor = isActiveHighlightElement(element)
      ? element.style.backgroundColor
      : null;

    Array.from(element.attributes).forEach((attribute) => {
      element.removeAttribute(attribute.name);
    });

    if (highlightColor) {
      element.classList.add("detail-highlight");
      element.style.setProperty(
        "--detail-highlight-color",
        highlightColor,
      );
    }
  });

  detailSentence.replaceChildren(...source.childNodes);
}

function showSentenceDetail(entry) {
  activeDrawerEntry = entry;
  renderDetailSentence(entry);
  detailDate.textContent = entry?.dateLabel || "";
  detailDate.dateTime = entry?.date || "";
  detailActionButton.textContent = entry ? "편집하기" : "수집하기";
  detailScroll.scrollTop = 0;
  detailDialog.showModal();
  window.requestAnimationFrame(updateDetailToTopVisibility);
}

function closeSentenceDetail() {
  if (detailDialog.open) {
    detailDialog.close();
  }
}

function playHomeIntro() {
  document.body.classList.remove("home-intro");
  void document.body.offsetWidth;
  document.body.classList.add("home-intro");
  resolveFirstHomeIntroStart?.();
  resolveFirstHomeIntroStart = null;
}

function showHome({ updateHistory = true } = {}) {
  closeSentenceDetail();
  deactivateHighlightTool();
  showRandomCollectedSentence();
  document.body.classList.remove("drawer-open", "collect-open");
  drawerView.hidden = true;
  collectView.hidden = true;
  drawerButton.classList.remove("is-active");
  drawerButton.removeAttribute("aria-current");
  collectButton.classList.remove("is-active");
  collectButton.removeAttribute("aria-current");
  playHomeIntro();

  if (updateHistory) {
    history.pushState(null, "", "#home");
  }
}

function showDrawer({ updateHistory = true } = {}) {
  closeSentenceDetail();
  deactivateHighlightTool();
  drawerView.hidden = false;
  renderDrawer();
  document.body.classList.remove("collect-open");
  document.body.classList.add("drawer-open");
  collectView.hidden = true;
  drawerButton.classList.add("is-active");
  drawerButton.setAttribute("aria-current", "page");
  collectButton.classList.remove("is-active");
  collectButton.removeAttribute("aria-current");
  drawerView.scrollTop = 0;

  if (updateHistory) {
    history.pushState(null, "", "#drawer");
  }
}

function showCollect({ updateHistory = true } = {}) {
  closeSentenceDetail();
  deactivateHighlightTool();
  document.body.classList.remove("drawer-open");
  document.body.classList.add("collect-open");
  drawerView.hidden = true;
  collectView.hidden = false;
  drawerButton.classList.remove("is-active");
  drawerButton.removeAttribute("aria-current");
  collectButton.classList.add("is-active");
  collectButton.setAttribute("aria-current", "page");
  document.querySelector(".highlight-palette")?.classList.remove("is-open");
  document
    .querySelector(".highlight-pencil")
    ?.setAttribute("aria-expanded", "false");
  document
    .querySelector(".highlight-pencil")
    ?.setAttribute("aria-label", "하이라이트 색상 열기");

  requestAnimationFrame(() => {
    collectorAuthorInputs.forEach((input) => {
      resizeAuthorInput(input);
      input.blur();
      input.setSelectionRange(0, 0);
      input.scrollLeft = 0;
    });
    document.querySelectorAll(".collector-copy").forEach((copy) => {
      copy.scrollTop = 0;
      updateCopyFade(copy);
    });
  });

  if (updateHistory) {
    history.pushState(null, "", "#collect");
  }
}

drawerButton.addEventListener("click", (event) => {
  event.preventDefault();
  showDrawer();
});

mainMoreButton.addEventListener("click", () => {
  const selectedEntry = currentMainEntry;
  showDrawer();
  showSentenceDetail(selectedEntry);
});

collectButton.addEventListener("click", (event) => {
  event.preventDefault();
  showCollect();
});

brandButton.addEventListener("click", (event) => {
  event.preventDefault();
  showHome();
});

detailCloseButton.addEventListener("click", closeSentenceDetail);
function updateDetailToTopVisibility() {
  const hasOverflow = detailScroll.scrollHeight > detailScroll.clientHeight + 1;
  const shouldShow = hasOverflow && detailScroll.scrollTop > 24;
  const isAtBottom =
    detailScroll.scrollTop + detailScroll.clientHeight >=
    detailScroll.scrollHeight - 2;
  detailToTopButton.classList.toggle("is-visible", shouldShow);
  detailToTopButton.setAttribute("aria-hidden", String(!shouldShow));
  detailDialog.classList.toggle(
    "has-top-fade",
    hasOverflow && detailScroll.scrollTop > 2,
  );
  detailDialog.classList.toggle(
    "has-bottom-fade",
    hasOverflow && !isAtBottom,
  );
}

detailScroll.addEventListener("scroll", updateDetailToTopVisibility, {
  passive: true,
});
detailToTopButton.addEventListener("click", () => {
  detailScroll.scrollTo({ top: 0, behavior: "smooth" });
});
detailActionButton.addEventListener("click", () => {
  const targetEntry = activeDrawerEntry;

  if (targetEntry) {
    currentSpreadIndex = targetEntry.spreadIndex;
    renderCollectorSpread();
  }

  closeSentenceDetail();
  showCollect();
});

detailDialog.addEventListener("click", (event) => {
  if (event.target === detailDialog) {
    closeSentenceDetail();
  }
});

const authorMeasureCanvas = document.createElement("canvas");
const authorMeasureContext = authorMeasureCanvas.getContext("2d");

function resizeAuthorInput(input) {
  if (input.closest(".collector-page-left")) {
    input.style.removeProperty("width");
    return;
  }

  syncRightAuthorBoundary();

  const visibleText = input.value || input.placeholder || "";
  authorMeasureContext.font = getComputedStyle(input).font;
  const measuredWidth = authorMeasureContext.measureText(visibleText).width;
  const authorRow = input.closest(".collector-author");
  const fixedLabel = authorRow.querySelector("span");
  const rowStyles = getComputedStyle(authorRow);
  const gapWidth = Number.parseFloat(rowStyles.columnGap) || 0;
  const availableWidth =
    authorRow.clientWidth - fixedLabel.offsetWidth - gapWidth;
  const targetWidth =
    availableWidth > 0
      ? Math.min(measuredWidth + 2, availableWidth)
      : measuredWidth + 2;

  input.style.width = `${Math.max(2, Math.ceil(targetWidth))}px`;
}

function syncRightAuthorBoundary() {
  const leftPage = document.querySelector(".collector-page-left");
  const rightPage = document.querySelector(".collector-page-right");
  const leftInput = leftPage?.querySelector(".collector-author input");
  const leftDate = leftPage?.querySelector(".collector-date");
  const rightAuthor = rightPage?.querySelector(".collector-author");
  const rightDate = rightPage?.querySelector(".collector-date");

  if (!leftInput || !leftDate || !rightAuthor || !rightDate) return;

  const leftInputRect = leftInput.getBoundingClientRect();
  const leftDateRect = leftDate.getBoundingClientRect();
  const rightAuthorRect = rightAuthor.getBoundingClientRect();
  const rightDateRect = rightDate.getBoundingClientRect();

  if (!rightAuthorRect.width || !rightDateRect.width) return;

  const referenceGap = Math.max(0, leftDateRect.left - leftInputRect.right);
  const fixedLeftEdge = rightDateRect.right + referenceGap;
  const fixedWidth = Math.max(2, rightAuthorRect.right - fixedLeftEdge);

  rightAuthor.style.width = `${fixedWidth}px`;
}

function updateCopyFade(copy) {
  const page = copy.closest(".collector-page");
  const distanceFromBottom =
    copy.scrollHeight - copy.clientHeight - copy.scrollTop;
  page.classList.toggle(
    "is-copy-scrolled",
    copy.scrollHeight > copy.clientHeight + 1 && distanceFromBottom > 2,
  );
}

function keepCopyCaretAtBottom(copy) {
  requestAnimationFrame(() => {
    copy.scrollTop = copy.scrollHeight;
    updateCopyFade(copy);
  });
}

const collectorAuthorInputs = document.querySelectorAll(
  ".collector-author input",
);
const highlightPencil = document.querySelector(".highlight-pencil");
const highlightSwatches = document.querySelectorAll(".highlight-swatch");
const highlightPalette = document.querySelector(".highlight-palette");
const highlightColorSettingKey =
  "sentence-calendar-highlight-color-setting-v1";
let selectedHighlightColor = "rgb(255, 230, 0)";
let isHighlightToolActive = false;
let removeHighlightOnDrag = false;
let highlightDragCopy = null;
let highlightDragStart = null;
let highlightPreviewRange = null;
let highlightPointerId = null;
let pencilReturnAnimation = null;

function setHighlightColor(color, darkColor) {
  selectedHighlightColor = color;
  document.documentElement.style.setProperty("--active-highlight-color", color);
  highlightPencil.style.setProperty("--highlight-color", color);
  highlightPencil.style.setProperty("--highlight-dark", darkColor);

  highlightSwatches.forEach((swatch) => {
    const selected = swatch.dataset.color === color;
    swatch.setAttribute("aria-pressed", String(selected));
  });
  localStorage.setItem(
    highlightColorSettingKey,
    JSON.stringify({ color, darkColor }),
  );
}

try {
  const savedHighlightColor = JSON.parse(
    localStorage.getItem(highlightColorSettingKey),
  );
  const matchingSwatch = Array.from(highlightSwatches).find(
    (swatch) => swatch.dataset.color === savedHighlightColor?.color,
  );
  if (matchingSwatch) {
    setHighlightColor(
      matchingSwatch.dataset.color,
      matchingSwatch.dataset.darkColor,
    );
  }
} catch {
  // 설정값이 없거나 손상된 경우 기본 연노란색을 사용합니다.
}

function moveHighlightPencil(clientX, clientY) {
  document.documentElement.style.setProperty("--pencil-x", `${clientX}px`);
  document.documentElement.style.setProperty("--pencil-y", `${clientY}px`);
}

function activateHighlightTool(event) {
  isHighlightToolActive = true;
  moveHighlightPencil(event.clientX, event.clientY);
  document.body.classList.add("highlight-tool-active");
  window.getSelection()?.removeAllRanges();
  collectorAuthorInputs.forEach((input) => {
    input.blur();
    input.setSelectionRange?.(0, 0);
    input.disabled = true;
  });
  let rightPageHasContent = false;
  document.querySelectorAll(".collector-page").forEach((page) => {
    const copy = page.querySelector(".collector-copy");
    const hasContent = Boolean(copy?.textContent.trim());
    page.classList.toggle("has-highlight-content", hasContent);
    if (page.classList.contains("collector-page-right")) {
      rightPageHasContent = hasContent;
    }
  });
  if (rightPageHasContent) setRightPageLocked(false);
  collectorAuthorInputs.forEach((input) => {
    input.disabled = true;
  });
  document
    .querySelectorAll(".collector-page.has-highlight-content .collector-copy")
    .forEach((copy) => {
      copy.contentEditable = "false";
    });
  highlightPencil.classList.add("is-drawing");
  highlightPalette.classList.add("is-open");
  highlightPencil.setAttribute("aria-expanded", "true");
  highlightPencil.setAttribute("aria-label", "하이라이트 도구 사용 중");
}

function returnHighlightPencilToHome() {
  if (!highlightPencil.classList.contains("is-drawing")) return;

  pencilReturnAnimation?.cancel();
  const homeClone = highlightPencil.cloneNode(true);
  homeClone.removeAttribute("id");
  homeClone.classList.remove("is-drawing");
  homeClone.style.visibility = "hidden";
  homeClone.style.transition = "none";
  highlightPencil.after(homeClone);
  const homeRect = homeClone.getBoundingClientRect();
  homeClone.remove();

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    highlightPencil.classList.remove("is-drawing");
    return;
  }

  const currentStyle = getComputedStyle(highlightPencil);
  pencilReturnAnimation = highlightPencil.animate(
    [
      {
        top: currentStyle.top,
        left: currentStyle.left,
        transform: "translate(-50%, 0) rotate(-30deg)",
      },
      {
        top: `${homeRect.top}px`,
        left: `${homeRect.left}px`,
        transform: "translate(0, 0) rotate(0deg) scale(1)",
      },
    ],
    {
      duration: 520,
      easing: "cubic-bezier(0.22, 0.72, 0.25, 1)",
      fill: "forwards",
    },
  );

  pencilReturnAnimation.addEventListener(
    "finish",
    () => {
      highlightPencil.classList.remove("is-drawing");
      pencilReturnAnimation.cancel();
      pencilReturnAnimation = null;
    },
    { once: true },
  );
}

function deactivateHighlightTool({ animatePencil = false } = {}) {
  isHighlightToolActive = false;
  removeHighlightOnDrag = false;
  highlightDragCopy = null;
  highlightDragStart = null;
  highlightPreviewRange = null;
  highlightPointerId = null;
  CSS.highlights?.delete("sentence-highlight-preview");
  document.body.classList.remove(
    "highlight-tool-active",
    "remove-highlight-preview",
  );
  if (animatePencil) {
    returnHighlightPencilToHome();
  } else {
    pencilReturnAnimation?.cancel();
    pencilReturnAnimation = null;
    highlightPencil?.classList.remove("is-drawing");
  }
  highlightPalette?.classList.remove("is-open");
  highlightPencil?.setAttribute("aria-expanded", "false");
  highlightPencil?.setAttribute("aria-label", "하이라이트 색상 열기");
  document.querySelectorAll(".collector-page").forEach((page) => {
    page.classList.remove("has-highlight-content");
  });
  setRightPageLocked(!isLeftPageSaved);
  leftCollectorPage.querySelector(".collector-author input").disabled = false;
  leftCollectorPage.querySelector(".collector-copy").contentEditable = "true";
  window.getSelection()?.removeAllRanges();
}

function nodeElement(node) {
  return node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
}

function isActiveHighlightElement(element) {
  const color = element?.style?.backgroundColor
    ?.replaceAll(" ", "")
    .toLowerCase();

  return Boolean(
    color &&
      color !== "white" &&
      color !== "#fff" &&
      color !== "#ffffff" &&
      color !== "rgb(255,255,255)" &&
      color !== "transparent" &&
      color !== "rgba(0,0,0,0)",
  );
}

function closestActiveHighlight(node) {
  let element = nodeElement(node);

  while (element) {
    if (isActiveHighlightElement(element)) return element;
    if (element.style?.backgroundColor) return null;
    if (element.classList?.contains("collector-copy")) break;
    element = element.parentElement;
  }

  return null;
}

function highlightMetadata(node, copy) {
  let element = nodeElement(node);
  while (element && element !== copy) {
    if (isActiveHighlightElement(element)) {
      return {
        color: element.style.backgroundColor,
        groupId: element.dataset.highlightGroup || "",
        lines: element.dataset.highlightLines || "",
      };
    }
    if (element.style?.backgroundColor) return null;
    element = element.parentElement;
  }
  return null;
}

function normalizeHighlightMarkup(copy) {
  const backgroundElements = Array.from(
    copy.querySelectorAll('[style*="background-color"]'),
  );
  if (!backgroundElements.length) return false;

  const walker = document.createTreeWalker(
    copy,
    NodeFilter.SHOW_TEXT,
  );
  const highlightedTextNodes = [];
  let textNode = walker.nextNode();

  while (textNode) {
    const metadata = highlightMetadata(textNode, copy);
    if (metadata) highlightedTextNodes.push({ node: textNode, ...metadata });
    textNode = walker.nextNode();
  }

  backgroundElements.reverse().forEach((element) => {
    element.replaceWith(...element.childNodes);
  });

  highlightedTextNodes.forEach(({ node, color, groupId, lines }) => {
    if (!node.isConnected || !node.data.length) return;
    const highlight = document.createElement("span");
    highlight.className = "text-highlight-segment";
    highlight.style.backgroundColor = color;
    if (groupId) highlight.dataset.highlightGroup = groupId;
    if (lines) highlight.dataset.highlightLines = lines;
    node.parentNode.insertBefore(highlight, node);
    highlight.appendChild(node);
  });

  copy.normalize();
  return true;
}

function rangeContainsHighlight(range) {
  const startHighlight = closestActiveHighlight(range.startContainer);
  const endHighlight = closestActiveHighlight(range.endContainer);

  if (startHighlight || endHighlight) return true;

  return Array.from(
    range
      .cloneContents()
      .querySelectorAll?.('[style*="background-color"]') || [],
  ).some(isActiveHighlightElement);
}

const maxHighlightLinesPerPage = 3;

function countHighlightLinesForPage(page, pendingRange = null) {
  const copy = page.querySelector(".collector-copy");
  const lineTops = [];
  const addRects = (rects) => {
    Array.from(rects).forEach((rect) => {
      if (!rect.width || !rect.height) return;
      if (!lineTops.some((top) => Math.abs(top - rect.top) < 4)) {
        lineTops.push(rect.top);
      }
    });
  };

  const walker = document.createTreeWalker(
    copy,
    NodeFilter.SHOW_TEXT,
  );
  let textNode = walker.nextNode();

  while (textNode) {
    if (
      textNode.data.trim() &&
      closestActiveHighlight(textNode)
    ) {
      const textRange = document.createRange();
      textRange.selectNodeContents(textNode);
      addRects(textRange.getClientRects());
    }
    textNode = walker.nextNode();
  }

  if (pendingRange) addRects(pendingRange.getClientRects());
  return lineTops.length;
}

function paintRangeBackground(copy, range, color, metadata = null) {
  const walker = document.createTreeWalker(
    copy,
    NodeFilter.SHOW_TEXT,
  );
  const selectedTextNodes = [];
  let textNode = walker.nextNode();

  while (textNode) {
    if (
      textNode.data.length &&
      range.intersectsNode(textNode)
    ) {
      selectedTextNodes.push(textNode);
    }
    textNode = walker.nextNode();
  }

  selectedTextNodes.reverse().forEach((node) => {
    const start =
      node === range.startContainer ? range.startOffset : 0;
    const end =
      node === range.endContainer ? range.endOffset : node.data.length;

    if (start >= end) return;

    if (end < node.data.length) node.splitText(end);
    const selectedNode = start > 0 ? node.splitText(start) : node;
    const highlight = document.createElement("span");
    highlight.className = "text-highlight-segment";
    highlight.style.backgroundColor = color;
    if (metadata?.groupId) {
      highlight.dataset.highlightGroup = metadata.groupId;
    }
    if (metadata?.lines?.length) {
      highlight.dataset.highlightLines = JSON.stringify(metadata.lines);
    }
    selectedNode.parentNode.insertBefore(highlight, selectedNode);
    highlight.appendChild(selectedNode);
  });

  copy.normalize();
  normalizeHighlightMarkup(copy);
  return selectedTextNodes.length > 0;
}

function highlightedRowsInRange(range) {
  const rows = [];
  const root = range.commonAncestorContainer;
  const walker = document.createTreeWalker(
    root.nodeType === Node.TEXT_NODE ? root.parentElement : root,
    NodeFilter.SHOW_TEXT,
  );
  let textNode = walker.nextNode();

  while (textNode) {
    if (textNode.data && range.intersectsNode(textNode)) {
      const start = textNode === range.startContainer ? range.startOffset : 0;
      const end = textNode === range.endContainer
        ? range.endOffset
        : textNode.data.length;

      for (let offset = start; offset < end; offset += 1) {
        const characterRange = document.createRange();
        characterRange.setStart(textNode, offset);
        characterRange.setEnd(textNode, offset + 1);
        const rect = Array.from(characterRange.getClientRects()).find(
          (candidate) => candidate.width || candidate.height,
        );
        if (!rect) continue;

        let row = rows.find((candidate) => Math.abs(candidate.top - rect.top) < 4);
        if (!row) {
          row = { top: rect.top, text: "" };
          rows.push(row);
        }
        row.text += textNode.data[offset];
      }
    }
    textNode = walker.nextNode();
  }

  return rows
    .sort((a, b) => a.top - b.top)
    .map((row) => row.text.trim())
    .filter(Boolean);
}

function caretPointRange(copy, clientX, clientY) {
  const bounds = copy.getBoundingClientRect();
  const x = Math.min(Math.max(clientX, bounds.left + 1), bounds.right - 1);
  const y = Math.min(Math.max(clientY, bounds.top + 1), bounds.bottom - 1);
  const range = document.caretRangeFromPoint?.(x, y);
  const container = nodeElement(range?.startContainer);
  return container?.closest(".collector-copy") === copy ? range : null;
}

function updateHighlightPreview(clientX, clientY) {
  if (!highlightDragCopy || !highlightDragStart) return;
  const endRange = caretPointRange(
    highlightDragCopy,
    clientX,
    clientY,
  );
  if (!endRange) return;

  const startRange = document.createRange();
  startRange.setStart(
    highlightDragStart.container,
    highlightDragStart.offset,
  );
  startRange.collapse(true);

  const previewRange = document.createRange();
  const startComesFirst =
    startRange.compareBoundaryPoints(
      Range.START_TO_START,
      endRange,
    ) <= 0;

  if (startComesFirst) {
    previewRange.setStart(
      highlightDragStart.container,
      highlightDragStart.offset,
    );
    previewRange.setEnd(
      endRange.startContainer,
      endRange.startOffset,
    );
  } else {
    previewRange.setStart(
      endRange.startContainer,
      endRange.startOffset,
    );
    previewRange.setEnd(
      highlightDragStart.container,
      highlightDragStart.offset,
    );
  }

  highlightPreviewRange = previewRange;
  removeHighlightOnDrag = rangeContainsHighlight(previewRange);
  document.documentElement.style.setProperty(
    "--highlight-preview-color",
    removeHighlightOnDrag ? "white" : selectedHighlightColor,
  );
  document.body.classList.toggle(
    "remove-highlight-preview",
    removeHighlightOnDrag,
  );
  CSS.highlights?.set(
    "sentence-highlight-preview",
    new Highlight(previewRange),
  );
}

function cancelHighlightDrag() {
  highlightDragCopy = null;
  highlightDragStart = null;
  highlightPreviewRange = null;
  highlightPointerId = null;
  removeHighlightOnDrag = false;
  CSS.highlights?.delete("sentence-highlight-preview");
  window.getSelection()?.removeAllRanges();
  document.body.classList.remove("remove-highlight-preview");
}

highlightSwatches.forEach((swatch) => {
  swatch.addEventListener("pointerdown", (event) => event.preventDefault());
  swatch.addEventListener("click", () => {
    setHighlightColor(swatch.dataset.color, swatch.dataset.darkColor);
  });
});

highlightPencil.addEventListener("pointerdown", (event) =>
  event.preventDefault(),
);
highlightPencil.addEventListener("click", (event) => {
  activateHighlightTool(event);
});

document.addEventListener("pointermove", (event) => {
  if (isHighlightToolActive) {
    moveHighlightPencil(event.clientX, event.clientY);
    if (event.pointerId === highlightPointerId) {
      updateHighlightPreview(event.clientX, event.clientY);
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isHighlightToolActive) {
    deactivateHighlightTool({ animatePencil: true });
    return;
  }

  if (
    event.key.toLowerCase() === "z" &&
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    shouldBlockCollectorUndo(event.target)
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});

document.addEventListener("dragstart", (event) => {
  if (
    isHighlightToolActive &&
    event.target.closest?.(".collector-page")
  ) {
    event.preventDefault();
  }
});

function insertPlainTextAtCaret(copy, text) {
  const selection = window.getSelection();
  let range = selection?.rangeCount ? selection.getRangeAt(0) : null;

  if (!range || !copy.contains(range.commonAncestorContainer)) {
    range = document.createRange();
    range.selectNodeContents(copy);
    range.collapse(false);
  }

  range.deleteContents();
  const fragment = document.createDocumentFragment();
  const normalizedText = text.replace(/\r\n?/g, "\n");
  normalizedText.split("\n").forEach((line, index) => {
    if (index > 0) fragment.append(document.createElement("br"));
    if (line) fragment.append(document.createTextNode(line));
  });

  const lastNode = fragment.lastChild;
  range.insertNode(fragment);
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function removePastedAlignment(copy) {
  copy.querySelectorAll("[align], [dir], [style]").forEach((element) => {
    element.removeAttribute("align");
    element.removeAttribute("dir");
    if (element.hasAttribute("style")) {
      element.style.removeProperty("text-align");
      element.style.removeProperty("direction");
      if (!element.getAttribute("style")?.trim()) {
        element.removeAttribute("style");
      }
    }
  });
}

document.querySelectorAll(".collector-copy").forEach((copy) => {
  copy.addEventListener("paste", (event) => {
    if (isHighlightToolActive) return;
    const plainText = event.clipboardData?.getData("text/plain");
    if (plainText === undefined) return;

    event.preventDefault();
    beginPageContentEditing(copy.closest(".collector-page"), true);
    insertPlainTextAtCaret(copy, plainText);
    removePastedAlignment(copy);
    copy.dispatchEvent(new Event("input", { bubbles: true }));
  });

  copy.addEventListener("beforeinput", (event) => {
    if (isHighlightToolActive) return;
    beginPageContentEditing(copy.closest(".collector-page"), true);
  });

  copy.addEventListener("pointerdown", (event) => {
    if (
      !isHighlightToolActive ||
      (copy.closest(".collector-page")?.classList.contains("is-locked") &&
        !copy
          .closest(".collector-page")
          ?.classList.contains("has-highlight-content"))
    ) {
      return;
    }

    document.activeElement?.blur?.();
    window.getSelection()?.removeAllRanges();
    const startRange = caretPointRange(
      copy,
      event.clientX,
      event.clientY,
    );
    if (!startRange) return;

    event.preventDefault();
    highlightDragCopy = copy;
    highlightDragStart = {
      container: startRange.startContainer,
      offset: startRange.startOffset,
    };
    highlightPreviewRange = startRange.cloneRange();
    highlightPointerId = event.pointerId;
    copy.setPointerCapture?.(event.pointerId);
    removeHighlightOnDrag = Boolean(closestActiveHighlight(event.target));
    document.body.classList.toggle(
      "remove-highlight-preview",
      removeHighlightOnDrag,
    );
  });
});

document.addEventListener("pointerup", () => {
  const copy = highlightDragCopy;
  const completedRange = highlightPreviewRange?.cloneRange() || null;
  highlightDragCopy = null;
  highlightDragStart = null;
  highlightPreviewRange = null;
  highlightPointerId = null;
  CSS.highlights?.delete("sentence-highlight-preview");
  if (!isHighlightToolActive || !copy) return;

  requestAnimationFrame(() => {
      if (!completedRange || completedRange.collapsed) {
        removeHighlightOnDrag = false;
        document.body.classList.remove("remove-highlight-preview");
        return;
      }

      const range = completedRange;
      const startElement =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer.parentElement;
      const endElement =
        range.endContainer.nodeType === Node.ELEMENT_NODE
          ? range.endContainer
          : range.endContainer.parentElement;

      if (
        startElement?.closest(".collector-copy") !== copy ||
        endElement?.closest(".collector-copy") !== copy
      ) {
        removeHighlightOnDrag = false;
        document.body.classList.remove("remove-highlight-preview");
        return;
      }

      removeHighlightOnDrag = rangeContainsHighlight(range);
      if (
        !removeHighlightOnDrag &&
        countHighlightLinesForPage(
          copy.closest(".collector-page"),
          range,
        ) > maxHighlightLinesPerPage
      ) {
        removeHighlightOnDrag = false;
        document.body.classList.remove("remove-highlight-preview");
        return;
      }

      const normalizedRange = range.cloneRange();
      const highlightMetadataForSelection = removeHighlightOnDrag
        ? null
        : {
            groupId: createSentenceId(),
            lines: highlightedRowsInRange(normalizedRange),
          };

      const changed = paintRangeBackground(
        copy,
        normalizedRange,
        removeHighlightOnDrag
          ? "transparent"
          : selectedHighlightColor,
        highlightMetadataForSelection,
      );

      if (changed) {
        copy.dispatchEvent(
          new CustomEvent("input", {
            bubbles: true,
            detail: { highlightOnly: true },
          }),
        );
      }

      removeHighlightOnDrag = false;
      document.body.classList.remove("remove-highlight-preview");
  });
});

document.addEventListener("pointercancel", cancelHighlightDrag);

const leftCollectorPage = document.querySelector(".collector-page-left");
const rightCollectorPage = document.querySelector(".collector-page-right");
const leftSaveButton = document.querySelector(".page-save-left");
const rightSaveButton = document.querySelector(".page-save-right");
const previousSpreadButton = document.querySelector(".spread-nav-prev");
const nextSpreadButton = document.querySelector(".spread-nav-next");
const spreadPosition = document.querySelector(".spread-position");
const collectorStorageKey = "sentence-calendar-collector-spreads-v1";
const collectorDatabaseName = "sentence-calendar-database";
const collectorDatabaseVersion = 1;
const collectorStoreName = "sentences";
const collectorMigrationKey = "sentence-calendar-idb-migration-v1";
let isLeftPageSaved = false;
let isRightPageSaved = false;
let currentSpreadIndex = 0;
let lastCollectorUndoPage = leftCollectorPage;
let collectorDatabasePromise = null;
let collectorWriteQueue = Promise.resolve();
let collectorUsesLocalStorageFallback = false;
let collectorPersistedRecordMap = new Map();

document.addEventListener("focusin", (event) => {
  const page = event.target?.closest?.(".collector-page");
  if (page) lastCollectorUndoPage = page;
});

function createEmptySpread() {
  return { left: null, right: null };
}

function createSentenceId() {
  return globalThis.crypto?.randomUUID?.() ||
    `sentence-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openCollectorDatabase() {
  if (collectorDatabasePromise) return collectorDatabasePromise;

  collectorDatabasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(
      collectorDatabaseName,
      collectorDatabaseVersion,
    );
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(collectorStoreName)) {
        const store = database.createObjectStore(collectorStoreName, {
          keyPath: "id",
        });
        store.createIndex("order", "order", { unique: true });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });

  return collectorDatabasePromise;
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function readIndexedDbSentences() {
  const database = await openCollectorDatabase();
  const transaction = database.transaction(collectorStoreName, "readonly");
  const store = transaction.objectStore(collectorStoreName);
  const records = await requestAsPromise(store.getAll());
  records.sort((a, b) => a.order - b.order);
  collectorPersistedRecordMap = new Map(
    records.map((record) => [record.id, JSON.stringify(record)]),
  );
  return records;
}

async function replaceIndexedDbSentences(records) {
  const database = await openCollectorDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(
      collectorStoreName,
      "readwrite",
    );
    const store = transaction.objectStore(collectorStoreName);
    store.clear();
    records.forEach((record) => store.put(record));
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("abort", () => reject(transaction.error));
    transaction.addEventListener("error", () => reject(transaction.error));
  });
  collectorPersistedRecordMap = new Map(
    records.map((record) => [record.id, JSON.stringify(record)]),
  );
}

async function syncIndexedDbSentences(records) {
  const nextRecordMap = new Map(
    records.map((record) => [record.id, JSON.stringify(record)]),
  );
  const deletedIds = Array.from(collectorPersistedRecordMap.keys()).filter(
    (id) => !nextRecordMap.has(id),
  );
  const changedRecords = records.filter(
    (record) =>
      collectorPersistedRecordMap.get(record.id) !==
      nextRecordMap.get(record.id),
  );

  if (!deletedIds.length && !changedRecords.length) return;

  const database = await openCollectorDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(
      collectorStoreName,
      "readwrite",
    );
    const store = transaction.objectStore(collectorStoreName);
    deletedIds.forEach((id) => store.delete(id));
    changedRecords.forEach((record) => store.put(record));
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("abort", () => reject(transaction.error));
    transaction.addEventListener("error", () => reject(transaction.error));
  });
  collectorPersistedRecordMap = nextRecordMap;
}

function recordsToCollectorSpreads(records) {
  const spreads = [];
  for (let index = 0; index < records.length; index += 2) {
    spreads.push({
      left: records[index],
      right: records[index + 1] || null,
    });
  }
  return spreads.length ? spreads : [createEmptySpread()];
}

function collectorSpreadsToRecords(spreads = collectorSpreads) {
  return spreads
    .flatMap((spread) => [spread.left, spread.right])
    .filter(savedPageHasContent)
    .map((page, order) => ({
      ...page,
      id: page.id || createSentenceId(),
      order,
    }));
}

function readLegacyCollectorSpreads() {
  try {
    const saved = JSON.parse(localStorage.getItem(collectorStorageKey));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

async function loadCollectorSpreads() {
  try {
    const indexedRecords = await readIndexedDbSentences();
    if (indexedRecords.length) {
      localStorage.removeItem(collectorStorageKey);
      localStorage.setItem(collectorMigrationKey, "complete");
      return recordsToCollectorSpreads(indexedRecords);
    }

    const legacySpreads = readLegacyCollectorSpreads();
    const legacyRecords = collectorSpreadsToRecords(
      legacySpreads.length ? legacySpreads : [createEmptySpread()],
    );
    if (legacyRecords.length) {
      await replaceIndexedDbSentences(legacyRecords);
      localStorage.removeItem(collectorStorageKey);
      localStorage.setItem(collectorMigrationKey, "complete");
      return recordsToCollectorSpreads(legacyRecords);
    }
  } catch (error) {
    console.error("IndexedDB 문장 저장소를 불러오지 못했습니다.", error);
    collectorUsesLocalStorageFallback = true;
    const legacySpreads = readLegacyCollectorSpreads();
    if (legacySpreads.length) return legacySpreads;
  }

  return [createEmptySpread()];
}

let collectorSpreads = [createEmptySpread()];

function savedPageHasContent(savedPage) {
  return Boolean(
    savedPage?.author?.trim() &&
      savedHtmlToText(savedPage?.html || "").trim(),
  );
}

function repairCollectorSpreadOrder() {
  let repaired = false;

  collectorSpreads.forEach((spread) => {
    const hasLeft = savedPageHasContent(spread.left);
    const hasRight = savedPageHasContent(spread.right);

    if (!hasLeft && hasRight) {
      spread.left = spread.right;
      spread.right = null;
      repaired = true;
    } else if (!hasLeft && spread.left) {
      spread.left = null;
      repaired = true;
    }

    if (!savedPageHasContent(spread.right) && spread.right) {
      spread.right = null;
      repaired = true;
    }
  });

  return repaired;
}

function compactCollectorSpreads() {
  const savedPages = collectorSpreads
    .flatMap((spread) => [spread.left, spread.right])
    .filter(savedPageHasContent);
  const compactedSpreads = [];

  for (let index = 0; index < savedPages.length; index += 2) {
    compactedSpreads.push({
      left: savedPages[index],
      right: savedPages[index + 1] || null,
    });
  }

  collectorSpreads = compactedSpreads.length
    ? compactedSpreads
    : [createEmptySpread()];
}

function persistCollectorSpreads() {
  const records = collectorSpreadsToRecords();
  if (collectorUsesLocalStorageFallback) {
    localStorage.setItem(
      collectorStorageKey,
      JSON.stringify(collectorSpreads),
    );
    return Promise.resolve(true);
  }

  collectorWriteQueue = collectorWriteQueue
    .catch(() => undefined)
    .then(() => syncIndexedDbSentences(records))
    .catch((error) => {
      console.error("IndexedDB 문장 저장에 실패했습니다.", error);
      return false;
    });
  return collectorWriteQueue;
}

async function initializeCollectorStorage() {
  collectorSpreads = await loadCollectorSpreads();
  const stateBeforeRepair = JSON.stringify(collectorSpreads);
  repairCollectorSpreadOrder();
  compactCollectorSpreads();

  collectorSpreads.forEach((spread) => {
    ["left", "right"].forEach((side) => {
      if (spread[side] && !spread[side].id) {
        spread[side].id = createSentenceId();
      }
    });
  });

  const latestSavedSpreadIndex = collectorSpreads.findLastIndex(
    (spread) => spread.left || spread.right,
  );
  currentSpreadIndex =
    latestSavedSpreadIndex >= 0 ? latestSavedSpreadIndex : 0;

  if (JSON.stringify(collectorSpreads) !== stateBeforeRepair) {
    await persistCollectorSpreads();
  }
}

function plainHtmlFromHighlightedHtml(html) {
  const container = document.createElement("div");
  container.innerHTML = html || "";
  const highlightedElements = Array.from(
    container.querySelectorAll('[style*="background-color"]'),
  );
  highlightedElements.reverse().forEach((element) => {
    element.replaceWith(...element.childNodes);
  });
  container.normalize();
  return container.innerHTML;
}

function collectorPageMatchesSavedData(target) {
  const page = target?.closest?.(".collector-page");
  if (!page) return false;
  const side = page.classList.contains("collector-page-left")
    ? "left"
    : "right";
  const savedData = collectorSpreads[currentSpreadIndex]?.[side];
  if (!savedData) return false;

  const author = page.querySelector(".collector-author input").value;
  const currentHtml = plainHtmlFromHighlightedHtml(
    page.querySelector(".collector-copy").innerHTML,
  );
  const savedHtml = plainHtmlFromHighlightedHtml(savedData.html || "");
  return author === savedData.author && currentHtml === savedHtml;
}

function shouldBlockCollectorUndo(target) {
  if (collectView.hidden) return false;
  const page =
    target?.closest?.(".collector-page") ||
    document.activeElement?.closest?.(".collector-page") ||
    lastCollectorUndoPage;
  if (!page) return false;

  const pageIsSaved = page.classList.contains("collector-page-left")
    ? isLeftPageSaved
    : isRightPageSaved;
  return pageIsSaved || collectorPageMatchesSavedData(page);
}

function highlightRecordsFromHtml(html) {
  const container = document.createElement("div");
  container.innerHTML = html || "";
  const records = [];
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
  );
  let offset = 0;
  let textNode = walker.nextNode();

  while (textNode) {
    const length = textNode.data.length;
    let element = textNode.parentElement;
    let color = null;
    let groupId = "";
    let lines = "";

    while (element && element !== container) {
      if (isActiveHighlightElement(element)) {
        color = element.style.backgroundColor;
        groupId = element.dataset.highlightGroup || "";
        lines = element.dataset.highlightLines || "";
        break;
      }
      element = element.parentElement;
    }

    if (color && length) {
      const previous = records.at(-1);
      if (
        previous?.end === offset &&
        previous.color === color &&
        previous.groupId === groupId &&
        previous.lines === lines
      ) {
        previous.end += length;
        previous.text += textNode.data;
      } else {
        records.push({
          start: offset,
          end: offset + length,
          text: textNode.data,
          color,
          groupId,
          lines,
        });
      }
    }

    offset += length;
    textNode = walker.nextNode();
  }

  return records;
}

function textRangeFromOffsets(copy, start, end) {
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let offset = 0;
  let startPoint = null;
  let endPoint = null;
  let textNode = walker.nextNode();

  while (textNode) {
    const nextOffset = offset + textNode.data.length;
    if (!startPoint && start <= nextOffset) {
      startPoint = [textNode, Math.max(0, start - offset)];
    }
    if (!endPoint && end <= nextOffset) {
      endPoint = [textNode, Math.max(0, end - offset)];
      break;
    }
    offset = nextOffset;
    textNode = walker.nextNode();
  }

  if (!startPoint || !endPoint) return null;
  range.setStart(...startPoint);
  range.setEnd(...endPoint);
  return range;
}

function reapplySavedHighlights(copy, records) {
  const currentText = copy.textContent;
  const placements = records
    .map((record) => {
      let start = record.start;
      if (currentText.slice(start, start + record.text.length) !== record.text) {
        const matches = [];
        let match = currentText.indexOf(record.text);
        while (match !== -1) {
          matches.push(match);
          match = currentText.indexOf(record.text, match + 1);
        }
        if (!matches.length) return null;
        start = matches.reduce((closest, candidate) =>
          Math.abs(candidate - record.start) < Math.abs(closest - record.start)
            ? candidate
            : closest,
        );
      }
      return { ...record, start, end: start + record.text.length };
    })
    .filter(Boolean)
    .sort((a, b) => b.start - a.start);

  placements.forEach((record) => {
    const range = textRangeFromOffsets(copy, record.start, record.end);
    if (range) {
      let lines = [];
      try {
        const parsedLines = JSON.parse(record.lines || "[]");
        if (Array.isArray(parsedLines)) lines = parsedLines;
      } catch {
        lines = [];
      }
      paintRangeBackground(copy, range, record.color, {
        groupId: record.groupId,
        lines,
      });
    }
  });
}

function caretTextOffset(copy) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!copy.contains(range.startContainer)) return null;
  const preceding = document.createRange();
  preceding.selectNodeContents(copy);
  preceding.setEnd(range.startContainer, range.startOffset);
  return preceding.toString().length;
}

function restoreCaretAtTextOffset(copy, targetOffset) {
  if (targetOffset === null) return;
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let textNode = walker.nextNode();

  while (textNode) {
    const nextOffset = offset + textNode.data.length;
    if (targetOffset <= nextOffset) {
      const range = document.createRange();
      range.setStart(textNode, Math.max(0, targetOffset - offset));
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    offset = nextOffset;
    textNode = walker.nextNode();
  }
}

function beginPageContentEditing(page, preserveCaret = false) {
  if (!page || page.classList.contains("is-content-editing")) return;
  const copy = page.querySelector(".collector-copy");
  const caretOffset = preserveCaret ? caretTextOffset(copy) : null;
  copy.innerHTML = plainHtmlFromHighlightedHtml(copy.innerHTML);
  page.classList.add("is-content-editing");
  restoreCaretAtTextOffset(copy, caretOffset);
}

function restorePageHighlightsForDisplay(page) {
  if (!page?.classList.contains("is-content-editing")) return;
  const copy = page.querySelector(".collector-copy");
  const side = page.classList.contains("collector-page-left")
    ? "left"
    : "right";
  const savedData = collectorSpreads[currentSpreadIndex]?.[side];
  const records = highlightRecordsFromHtml(
    savedData?.highlightedHtml || "",
  );

  copy.innerHTML = plainHtmlFromHighlightedHtml(copy.innerHTML);
  reapplySavedHighlights(copy, records);
  page.classList.remove("is-content-editing");
}

function createSavedPageData(page, existingData = null) {
  const now = new Date();
  const copy = page.querySelector(".collector-copy");
  const previousHighlights = highlightRecordsFromHtml(
    existingData?.highlightedHtml || "",
  );
  const pageHtml = plainHtmlFromHighlightedHtml(copy.innerHTML);
  copy.innerHTML = pageHtml;
  reapplySavedHighlights(copy, previousHighlights);
  page.classList.remove("is-content-editing");
  return {
    id: existingData?.id || createSentenceId(),
    author: page.querySelector(".collector-author input").value.trim(),
    html: pageHtml,
    highlightedHtml: copy.innerHTML,
    date: existingData?.date || now.toISOString(),
    dateLabel: existingData?.dateLabel || formatDate(now),
  };
}

function persistHighlightChange(copy) {
  const page = copy.closest(".collector-page");
  const spread = collectorSpreads[currentSpreadIndex];
  const side = page.classList.contains("collector-page-left")
    ? "left"
    : "right";
  const savedData = spread?.[side];

  if (!savedData) return;

  const previousHighlightHtml =
    savedData.highlightedHtml || savedData.html;
  savedData.highlightedHtml = copy.innerHTML;

  try {
    persistCollectorSpreads();
  } catch {
    savedData.highlightedHtml = previousHighlightHtml;
    copy.innerHTML = previousHighlightHtml;
  }
}

function restorePageFromSavedData(page, savedData) {
  const author = page.querySelector(".collector-author input");
  const copy = page.querySelector(".collector-copy");
  author.value = savedData.author;
  copy.innerHTML = savedData.highlightedHtml || savedData.html;
  resizeAuthorInput(author);
  setPageDate(page, savedData);
}

function markCollectorPageDirty(page) {
  const isLeft = page.classList.contains("collector-page-left");
  const saveButton = isLeft ? leftSaveButton : rightSaveButton;

  if (isLeft) {
    isLeftPageSaved = false;
  } else {
    isRightPageSaved = false;
  }

  saveButton.disabled = !pageHasRequiredContent(page);
  saveButton.classList.remove("is-saved");
  saveButton.textContent = "저장";
  updateSpreadNavigation();
}

function setPageDate(page, savedData) {
  const date = page.querySelector(".collector-date");
  const now = new Date();
  date.textContent = savedData?.dateLabel || formatDate(now);
  date.dateTime = savedData?.date || now.toISOString();
}

function updateSpreadNavigation() {
  previousSpreadButton.disabled = currentSpreadIndex === 0;
  nextSpreadButton.disabled = !isLeftPageSaved || !isRightPageSaved;
}

function pageHasRequiredContent(page) {
  const author = page.querySelector(".collector-author input").value.trim();
  const copy = page.querySelector(".collector-copy").textContent.trim();
  return Boolean(author && copy);
}

function setRightPageLocked(locked) {
  const author = rightCollectorPage.querySelector(".collector-author input");
  const copy = rightCollectorPage.querySelector(".collector-copy");
  const deleteButton = rightCollectorPage.querySelector(".page-delete");

  rightCollectorPage.classList.toggle("is-locked", locked);
  rightCollectorPage.setAttribute("aria-disabled", String(locked));
  author.disabled = locked;
  copy.contentEditable = String(!locked);
  deleteButton.disabled = locked;
  rightSaveButton.disabled = locked || !pageHasRequiredContent(rightCollectorPage);
}

function renderCollectorSpread() {
  const spread = collectorSpreads[currentSpreadIndex] || createEmptySpread();
  const leftAuthor = leftCollectorPage.querySelector(".collector-author input");
  const rightAuthor = rightCollectorPage.querySelector(".collector-author input");
  const leftCopy = leftCollectorPage.querySelector(".collector-copy");
  const rightCopy = rightCollectorPage.querySelector(".collector-copy");

  leftCollectorPage.classList.add("is-spread-rendering");
  rightCollectorPage.classList.add("is-spread-rendering");

  leftCollectorPage.classList.remove("is-content-editing");
  rightCollectorPage.classList.remove("is-content-editing");
  leftAuthor.value = spread.left?.author || "";
  rightAuthor.value = spread.right?.author || "";
  leftCopy.innerHTML =
    spread.left?.highlightedHtml || spread.left?.html || "";
  rightCopy.innerHTML =
    spread.right?.highlightedHtml || spread.right?.html || "";
  const repairedLeftHighlights = normalizeHighlightMarkup(leftCopy);
  const repairedRightHighlights = normalizeHighlightMarkup(rightCopy);
  if (spread.left && repairedLeftHighlights) {
    spread.left.highlightedHtml = leftCopy.innerHTML;
  }
  if (spread.right && repairedRightHighlights) {
    spread.right.highlightedHtml = rightCopy.innerHTML;
  }
  if (repairedLeftHighlights || repairedRightHighlights) {
    persistCollectorSpreads();
  }
  leftCopy.scrollTop = 0;
  rightCopy.scrollTop = 0;
  updateCopyFade(leftCopy);
  updateCopyFade(rightCopy);

  isLeftPageSaved = Boolean(spread.left);
  isRightPageSaved = Boolean(spread.right);
  leftSaveButton.disabled = !pageHasRequiredContent(leftCollectorPage);
  leftSaveButton.classList.toggle("is-saved", isLeftPageSaved);
  leftSaveButton.textContent = isLeftPageSaved ? "저장됨" : "저장";
  rightSaveButton.classList.toggle("is-saved", isRightPageSaved);
  rightSaveButton.textContent = isRightPageSaved ? "저장됨" : "저장";

  setPageDate(leftCollectorPage, spread.left);
  setPageDate(rightCollectorPage, spread.right);
  setRightPageLocked(!isLeftPageSaved);
  if (isRightPageSaved) rightSaveButton.disabled = false;
  updateSpreadNavigation();
  spreadPosition.textContent =
    `${currentSpreadIndex + 1}/${collectorSpreads.length}`;
  spreadPosition.setAttribute(
    "aria-label",
    `현재 ${currentSpreadIndex + 1}페이지, 전체 ${collectorSpreads.length}페이지`,
  );

  requestAnimationFrame(() => {
    resizeAuthorInput(leftAuthor);
    resizeAuthorInput(rightAuthor);
    updateCopyFade(leftCopy);
    updateCopyFade(rightCopy);
    requestAnimationFrame(() => {
      leftCollectorPage.classList.remove("is-spread-rendering");
      rightCollectorPage.classList.remove("is-spread-rendering");
    });
  });
}

collectorAuthorInputs.forEach((input) => {
  resizeAuthorInput(input);
  input.addEventListener("focus", () => {
    const page = input.closest(".collector-page");
    beginPageContentEditing(page);
  });
  input.addEventListener("blur", () => {
    restorePageHighlightsForDisplay(input.closest(".collector-page"));
  });
  input.addEventListener("input", () => {
    resizeAuthorInput(input);
    const page = input.closest(".collector-page");
    beginPageContentEditing(page);
    markCollectorPageDirty(page);
  });
});

document.fonts?.ready.then(() => {
  fitMainSentenceLines();
  updateMainAuthorOverflow();
  syncRightAuthorBoundary();
  collectorAuthorInputs.forEach(resizeAuthorInput);
  document
    .querySelectorAll(".sentence-card")
    .forEach(updateDrawerCardOverflow);
});

window.addEventListener("resize", () => {
  fitMainSentenceLines();
  updateMainAuthorOverflow();
  const rightAuthor = document.querySelector(
    ".collector-page-right .collector-author",
  );
  rightAuthor?.style.removeProperty("width");
  syncRightAuthorBoundary();
  collectorAuthorInputs.forEach(resizeAuthorInput);
  if (drawerVirtualState) {
    calculateDrawerVirtualMetrics();
    renderDrawerVirtualWindow();
  } else {
    document
      .querySelectorAll(".sentence-card")
      .forEach(updateDrawerCardOverflow);
  }
});

document.querySelectorAll(".collector-copy").forEach((copy) => {
  copy.addEventListener("focus", () => {
    if (isHighlightToolActive) return;
    const page = copy.closest(".collector-page");
    beginPageContentEditing(page, true);
  });
  copy.addEventListener("input", (event) => {
    if (event.detail?.highlightOnly) {
      persistHighlightChange(copy);
      return;
    }

    keepCopyCaretAtBottom(copy);
    markCollectorPageDirty(copy.closest(".collector-page"));
  });
  copy.addEventListener("scroll", () => updateCopyFade(copy));
  copy.addEventListener("blur", () => {
    restorePageHighlightsForDisplay(copy.closest(".collector-page"));
    if (!copy.textContent.trim()) {
      copy.replaceChildren();
      updateCopyFade(copy);
    }
  });
});

leftSaveButton.addEventListener("click", () => {
  if (!pageHasRequiredContent(leftCollectorPage)) return;
  isLeftPageSaved = true;
  collectorSpreads[currentSpreadIndex].left = createSavedPageData(
    leftCollectorPage,
    collectorSpreads[currentSpreadIndex].left,
  );
  persistCollectorSpreads();
  setPageDate(leftCollectorPage, collectorSpreads[currentSpreadIndex].left);
  leftSaveButton.disabled = false;
  leftSaveButton.classList.add("is-saved");
  leftSaveButton.textContent = "저장됨";
  setRightPageLocked(false);
  updateSpreadNavigation();
});

rightSaveButton.addEventListener("click", () => {
  if (!pageHasRequiredContent(rightCollectorPage)) return;
  isRightPageSaved = true;
  collectorSpreads[currentSpreadIndex].right = createSavedPageData(
    rightCollectorPage,
    collectorSpreads[currentSpreadIndex].right,
  );
  persistCollectorSpreads();
  setPageDate(rightCollectorPage, collectorSpreads[currentSpreadIndex].right);
  rightSaveButton.classList.add("is-saved");
  rightSaveButton.textContent = "저장됨";
  updateSpreadNavigation();
});

document.querySelectorAll(".page-delete").forEach((button) => {
  button.addEventListener("click", () => {
    const page = button.closest(".collector-page");
    const side = page === leftCollectorPage ? "left" : "right";
    collectorSpreads[currentSpreadIndex][side] = null;
    compactCollectorSpreads();
    currentSpreadIndex = Math.min(
      currentSpreadIndex,
      collectorSpreads.length - 1,
    );
    persistCollectorSpreads();
    renderCollectorSpread();
  });
});

function saveValidDraftsBeforePageTurn() {
  const spread = collectorSpreads[currentSpreadIndex];
  if (pageHasRequiredContent(leftCollectorPage)) {
    spread.left = createSavedPageData(leftCollectorPage, spread.left);
  }
  if (
    spread.left &&
    pageHasRequiredContent(rightCollectorPage)
  ) {
    spread.right = createSavedPageData(rightCollectorPage, spread.right);
  }
  persistCollectorSpreads();
}

previousSpreadButton.addEventListener("click", () => {
  if (currentSpreadIndex === 0) return;
  saveValidDraftsBeforePageTurn();
  currentSpreadIndex -= 1;
  renderCollectorSpread();
});

nextSpreadButton.addEventListener("click", () => {
  if (!isRightPageSaved) return;
  saveValidDraftsBeforePageTurn();
  if (currentSpreadIndex === collectorSpreads.length - 1) {
    collectorSpreads.push(createEmptySpread());
    persistCollectorSpreads();
  }
  currentSpreadIndex += 1;
  renderCollectorSpread();
});

function showCurrentRoute() {
  if (window.location.hash === "#drawer") {
    showDrawer({ updateHistory: false });
  } else if (window.location.hash === "#collect") {
    showCollect({ updateHistory: false });
  } else {
    showHome({ updateHistory: false });
  }

  delete document.documentElement.dataset.initialRoute;
}

const collectorStorageReady = initializeCollectorStorage().then(() => {
  renderCollectorSpread();
  showRandomCollectedSentence();
  showCurrentRoute();
});

window.addEventListener("popstate", () => {
  collectorStorageReady.then(showCurrentRoute);
});
