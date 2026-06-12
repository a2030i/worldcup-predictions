import { ALL_MATCHES } from "../src/data/tournament.js";

const TLA = { MX:"MEX", ZA:"RSA", KR:"KOR", CZ:"CZE", CA:"CAN", BA:"BIH", US:"USA", PY:"PAR",
  QA:"QAT", CH:"SUI", BR:"BRA", MA:"MAR", HT:"HAI", SCO:"SCO", AU:"AUS", TR:"TUR", DE:"GER",
  CW:"CUW", NL:"NED", JP:"JPN", CI:"CIV", EC:"ECU", SE:"SWE", TN:"TUN", ES:"ESP", CV:"CPV",
  BE:"BEL", EG:"EGY", SA:"KSA", UY:"URY", IR:"IRN", NZ:"NZL", FR:"FRA", SN:"SEN", IQ:"IRQ",
  NO:"NOR", AR:"ARG", DZ:"ALG", AT:"AUT", JO:"JOR", PT:"POR", CD:"COD", ENG:"ENG", HR:"CRO",
  GH:"GHA", PA:"PAN", UZ:"UZB", CO:"COL" };

const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches?dateFrom=2026-06-10&dateTo=2026-06-29",
  { headers: { "X-Auth-Token": process.env.FD_TOKEN } });
const data = await res.json();
console.log("FD matches:", data.matches.length, "| ours:", ALL_MATCHES.length);

const fdByKey = {};
for (const m of data.matches) {
  fdByKey[`${m.utcDate}|${m.homeTeam.tla}|${m.awayTeam.tla}`] = m;
}

let ok = 0; const problems = []; const tlasSeen = new Set();
for (const m of ALL_MATCHES) {
  const utc = new Date(m.kickoff).toISOString().replace(".000Z", "Z");
  const a = TLA[m.a], b = TLA[m.b];
  tlasSeen.add(m.a); tlasSeen.add(m.b);
  const exact = fdByKey[`${utc}|${a}|${b}`];
  const swapped = fdByKey[`${utc}|${b}|${a}`];
  if (exact) ok++;
  else if (swapped) problems.push(`SWAPPED: ${m.id}`);
  else {
    const sameTeams = data.matches.find(x =>
      (x.homeTeam.tla === a && x.awayTeam.tla === b) || (x.homeTeam.tla === b && x.awayTeam.tla === a));
    problems.push(`NO MATCH: ${m.id} utc=${utc} ${sameTeams ? "— found same teams at " + sameTeams.utcDate + (sameTeams.homeTeam.tla === a ? " (same order)" : " (swapped)") : "— teams not found at all"}`);
  }
}
console.log("exact matches:", ok, "/", ALL_MATCHES.length);
problems.forEach(p => console.log(p));
const fdTlas = new Set(data.matches.flatMap(x => [x.homeTeam.tla, x.awayTeam.tla]));
const unmapped = [...fdTlas].filter(t => !Object.values(TLA).includes(t));
console.log("FD TLAs not in our map:", unmapped.length ? unmapped : "none");
