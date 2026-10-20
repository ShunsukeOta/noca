const key = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

function nthMonday(year: number, month: number, occurrence: number) {
  const firstDay = new Date(year, month - 1, 1).getDay()
  return 1 + (8 - firstDay) % 7 + (occurrence - 1) * 7
}

function equinoxDay(year: number, spring: boolean) {
  const base = spring ? 20.8431 : 23.2488
  const elapsed = year - 1980
  return Math.floor(base + 0.242194 * elapsed - Math.floor(elapsed / 4))
}

export function getJapaneseHolidays(year: number) {
  const holidays = new Map<string, string>()
  const add = (month: number, day: number, name: string) => holidays.set(key(year, month, day), name)
  if (year < 2019 || year > 2099) return holidays

  add(1, 1, "元日")
  add(1, nthMonday(year, 1, 2), "成人の日")
  add(2, 11, "建国記念の日")
  if (year >= 2020) add(2, 23, "天皇誕生日")
  add(3, equinoxDay(year, true), "春分の日")
  add(4, 29, "昭和の日")
  add(5, 3, "憲法記念日")
  add(5, 4, "みどりの日")
  add(5, 5, "こどもの日")
  add(7, year === 2020 ? 23 : year === 2021 ? 22 : nthMonday(year, 7, 3), "海の日")
  add(8, year === 2020 ? 10 : year === 2021 ? 8 : 11, "山の日")
  add(9, nthMonday(year, 9, 3), "敬老の日")
  add(9, equinoxDay(year, false), "秋分の日")
  if (year === 2020) add(7, 24, "スポーツの日")
  else if (year === 2021) add(7, 23, "スポーツの日")
  else add(10, nthMonday(year, 10, 2), year === 2019 ? "体育の日" : "スポーツの日")
  add(11, 3, "文化の日")
  add(11, 23, "勤労感謝の日")
  if (year === 2019) {
    add(5, 1, "天皇の即位の日")
    add(10, 22, "即位礼正殿の儀")
  }

  const nationalDays = new Set(holidays.keys())
  const yearLength = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000
  const dateKey = (day: number) => {
    const date = new Date(year, 0, day)
    return key(year, date.getMonth() + 1, date.getDate())
  }
  for (let day = 2; day < yearLength; day += 1) {
    const current = dateKey(day)
    if (!holidays.has(current) && nationalDays.has(dateKey(day - 1)) && nationalDays.has(dateKey(day + 1))) {
      holidays.set(current, "休日")
    }
  }

  for (const dateKey of nationalDays) {
    const [, month, day] = dateKey.split("-").map(Number)
    let date = new Date(year, month - 1, day)
    if (date.getDay() !== 0) continue
    date.setDate(date.getDate() + 1)
    while (date.getFullYear() === year && holidays.has(key(year, date.getMonth() + 1, date.getDate()))) {
      date.setDate(date.getDate() + 1)
    }
    if (date.getFullYear() === year) holidays.set(key(year, date.getMonth() + 1, date.getDate()), "休日")
  }

  return holidays
}
