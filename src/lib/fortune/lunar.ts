/** Spring Festival (农历正月初一) solar dates — enough for typical birth years */
const CNY: Record<number, string> = {
  1988: "1988-02-17",
  1989: "1989-02-06",
  1990: "1990-01-27",
  1991: "1991-02-15",
  1992: "1992-02-04",
  1993: "1993-01-23",
  1994: "1994-02-10",
  1995: "1995-01-31",
  1996: "1996-02-19",
  1997: "1997-02-07",
  1998: "1998-01-28",
  1999: "1999-02-16",
  2000: "2000-02-05",
  2001: "2001-01-24",
  2002: "2002-02-12",
  2003: "2003-02-01",
  2004: "2004-01-22",
  2005: "2005-02-09",
  2006: "2006-01-29",
  2007: "2007-02-18",
  2008: "2008-02-07",
  2009: "2009-01-26",
  2010: "2010-02-14",
  2011: "2011-02-03",
  2012: "2012-01-23",
  2013: "2013-02-10",
  2014: "2014-01-31",
  2015: "2015-02-19",
  2016: "2016-02-08",
  2017: "2017-01-28",
  2018: "2018-02-16",
  2019: "2019-02-05",
  2020: "2020-01-25",
  2021: "2021-02-12",
  2022: "2022-02-01",
  2023: "2023-01-22",
  2024: "2024-02-10",
  2025: "2025-01-29",
  2026: "2026-02-17",
};

export function getLunarMonthDay(birthDate: string) {
  const solar = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(solar.getTime())) return null;

  const year = solar.getFullYear();
  const cnyStr = CNY[year];
  if (!cnyStr) {
    return { month: solar.getMonth() + 1, day: solar.getDate(), approximate: true as const };
  }

  const cny = new Date(`${cnyStr}T12:00:00`);
  if (solar < cny) {
    const prevCnyStr = CNY[year - 1];
    if (!prevCnyStr) {
      return { month: solar.getMonth() + 1, day: solar.getDate(), approximate: true as const };
    }
    const prevCny = new Date(`${prevCnyStr}T12:00:00`);
    const day = Math.floor((solar.getTime() - prevCny.getTime()) / 86400000) + 1;
    return { month: 12, day, approximate: false as const, lunarYear: year - 1 };
  }

  const day = Math.floor((solar.getTime() - cny.getTime()) / 86400000) + 1;
  let month = 1;
  let remain = day;
  const monthDays = [29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30];
  while (remain > monthDays[month - 1] && month < 12) {
    remain -= monthDays[month - 1];
    month += 1;
  }
  return { month, day: remain, approximate: false as const, lunarYear: year };
}
