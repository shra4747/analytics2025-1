import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { calcAuto, calcTele, calcEnd } from "@/util/calculations";

export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    const { rows } = await sql`SELECT * FROM sdr2025;`;
    let responseObject = {};

    const frcAPITeamData = await fetch(`https://www.thebluealliance.com/api/v3/event/2025MRCMP/teams`, {
      headers: {
        "X-TBA-Auth-Key": process.env.TBA_AUTH_KEY,
        "Accept": "application/json"
      },
    }).then(resp => {
      if (resp.status !== 200) {
        throw new Error(`Failed to fetch team data: ${resp.status}`);
      }
      return resp.json();
    });

    rows.forEach((row) => {
      if (!row.noshow) {
        let auto = calcAuto(row);
        let tele = calcTele(row);
        let end = calcEnd(row);

        let frcAPITeamInfo = frcAPITeamData.filter(teamData => parseInt(teamData.team_number) === parseInt(row.team));

        if (!responseObject[row.team]) {
          responseObject[row.team] = initializeTeamData(row, auto, tele, end, frcAPITeamInfo);
        } else {
          accumulateTeamData(responseObject[row.team], row, auto, tele, end);
        }
      }
    });

    calculateAverages(responseObject, rows);
    calculateLast3EPA(responseObject, rows);

    return NextResponse.json(responseObject, { status: 200 });

  } catch (error) {
    console.error("Error fetching alliance data:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

function initializeTeamData(row, auto, tele, end, frcAPITeamInfo) {
  return {
    team: row.team,
    teamName: frcAPITeamInfo.length === 0 ? "🤖" : frcAPITeamInfo[0].nickname,
    auto,
    tele,
    end,
    avgPieces: {
      L1: row.autol1success + row.telel1success,
      L2: row.autol2success + row.telel2success,
      L3: row.autol3success + row.telel3success,
      L4: row.autol4success + row.telel4success,
      net: row.autoprocessorsuccess + row.teleprocessorsuccess,
      processor: row.autonetsuccess + row.telenetsuccess,
      HP: row.hpsuccess,
    },
    leave: row.leave,
    autoCoral: row.autocoralsuccess,
    removedAlgae: row.autoalgaeremoved + row.telealgaeremoved,
    endgame: createEndgameData(row.endlocation),
    qualitative: {
      coralspeed: row.coralspeed,
      processorspeed: row.processorspeed,
      netspeed: row.netspeed,
      algaeremovalspeed: row.algaeremovalspeed,
      climbspeed: row.climbspeed,
      maneuverability: row.maneuverability,
      defenseplayed: row.defenseplayed,
      defenseevasion: row.defenseevasion,
      aggression: row.aggression,
      cagehazard: row.cagehazard,
    },
  };
}

function accumulateTeamData(teamData, row, auto, tele, end) {
  teamData.auto += auto;
  teamData.tele += tele;
  teamData.end += end;

  teamData.avgPieces.L1 += row.autol1success + row.telel1success;
  teamData.avgPieces.L2 += row.autol2success + row.telel2success;
  teamData.avgPieces.L3 += row.autol3success + row.telel3success;
  teamData.avgPieces.L4 += row.autol4success + row.telel4success;
  teamData.avgPieces.net += row.autoprocessorsuccess + row.teleprocessorsuccess;
  teamData.avgPieces.processor += row.autonetsuccess + row.telenetsuccess;
  teamData.avgPieces.HP += row.hpsuccess;
  teamData.removedAlgae += row.autoalgaeremoved + row.telealgaeremoved;

  const endgameData = createEndgameData(row.endlocation);
  for (let key in endgameData) {
    teamData.endgame[key] += endgameData[key];
  }

  teamData.qualitative.coralspeed += row.coralspeed;
  teamData.qualitative.processorspeed += row.processorspeed;
  teamData.qualitative.netspeed += row.netspeed;
  teamData.qualitative.algaeremovalspeed += row.algaeremovalspeed;
  teamData.qualitative.climbspeed += row.climbspeed;
  teamData.qualitative.maneuverability += row.maneuverability;
  teamData.qualitative.defenseplayed += row.defenseplayed;
  teamData.qualitative.defenseevasion += row.defenseevasion;
  teamData.qualitative.aggression += row.aggression;
  teamData.qualitative.cagehazard += row.cagehazard;
}

function createEndgameData(endlocation) {
  return {
    none: endlocation === 0 ? 1 : 0,
    park: endlocation === 1 ? 1 : 0,
    shallow: endlocation === 3 ? 1 : 0,
    deep: endlocation === 4 ? 1 : 0,
    fail: endlocation === 2 ? 1 : 0,
  };
}

function calculateAverages(responseObject, rows) {
  const average = (value, count) => (count > 0 ? Math.round((value / count) * 10) / 10 : 0);

  for (let team in responseObject) {
    let teamData = responseObject[team];
    let count = rows.filter((row) => row.team === parseInt(team)).length;

    teamData.auto = average(teamData.auto, count);
    teamData.tele = average(teamData.tele, count);
    teamData.end = average(teamData.end, count);
    teamData.avgPieces.L1 = average(teamData.avgPieces.L1, count);
    teamData.avgPieces.L2 = average(teamData.avgPieces.L2, count);
    teamData.avgPieces.L3 = average(teamData.avgPieces.L3, count);
    teamData.avgPieces.L4 = average(teamData.avgPieces.L4, count);
    teamData.avgPieces.net = average(teamData.avgPieces.net, count);
    teamData.avgPieces.processor = average(teamData.avgPieces.processor, count);
    teamData.avgPieces.HP = average(teamData.avgPieces.HP, count);
    teamData.removedAlgae = average(teamData.removedAlgae, count);

    let locationSum =
      teamData.endgame.none + teamData.endgame.park + teamData.endgame.shallow + teamData.endgame.deep + teamData.endgame.fail;

    teamData.endgame = locationSum > 0
      ? {
          none: Math.round((100 * teamData.endgame.none) / locationSum),
          park: Math.round((100 * teamData.endgame.park) / locationSum),
          shallow: Math.round((100 * teamData.endgame.shallow) / locationSum),
          deep: Math.round((100 * teamData.endgame.deep) / locationSum),
          fail: Math.round((100 * teamData.endgame.fail) / locationSum),
        }
      : { none: 100, park: 0, shallow: 0, deep: 0, fail: 0 };

    teamData.qualitative.coralspeed = average(teamData.qualitative.coralspeed, count);
    teamData.qualitative.processorspeed = average(teamData.qualitative.processorspeed, count);
    teamData.qualitative.netspeed = average(teamData.qualitative.netspeed, count);
    teamData.qualitative.algaeremovalspeed = average(teamData.qualitative.algaeremovalspeed, count);
    teamData.qualitative.climbspeed = average(teamData.qualitative.climbspeed, count);
    teamData.qualitative.maneuverability = average(teamData.qualitative.maneuverability, count);
    teamData.qualitative.defenseplayed = average(teamData.qualitative.defenseplayed, count);
    teamData.qualitative.defenseevasion = average(teamData.qualitative.defenseevasion, count);
    teamData.qualitative.aggression = average(teamData.qualitative.aggression, count);
    teamData.qualitative.cagehazard = average(teamData.qualitative.cagehazard, count);
  }
}

function calculateLast3EPA(responseObject, rows) {
  Object.keys(responseObject).forEach(team => {
    // Filter rows for this team and calculate metrics
    const teamRows = rows
      .filter(r => String(r.team) === String(team) && !r.noshow)
      .map(r => ({
        ...r,
        auto: calcAuto(r),
        tele: calcTele(r),
        end: calcEnd(r),
        epa: calcAuto(r) + calcTele(r) + calcEnd(r),
      }));
    
    // Group by match
    const matchGroups = {};
    teamRows.forEach(row => {
      if (!matchGroups[row.match]) {
        matchGroups[row.match] = [];
      }
      matchGroups[row.match].push(row);
    });
    
    // Calculate average per match
    const matchAverages = Object.entries(matchGroups).map(([match, matchRows]) => {
      return {
        match: parseInt(match),
        auto: matchRows.reduce((sum, r) => sum + r.auto, 0) / matchRows.length,
        tele: matchRows.reduce((sum, r) => sum + r.tele, 0) / matchRows.length,
        end: matchRows.reduce((sum, r) => sum + r.end, 0) / matchRows.length,
        epa: matchRows.reduce((sum, r) => sum + r.epa, 0) / matchRows.length
      };
    });
    
    // Sort by match number and take last 3 matches
    const last3Matches = matchAverages
      .sort((a, b) => a.match - b.match)
      .slice(-3);
    
    // Calculate averages for the last 3 matches
    const avg = (arr, field) => {
      if (arr.length === 0) return 0;
      const sum = arr.reduce((sum, r) => sum + (r[field] || 0), 0);
      return Math.round((sum / arr.length) * 10) / 10;
    };
    
    // Store the results
    responseObject[team].last3Auto = avg(last3Matches, "auto");
    responseObject[team].last3Tele = avg(last3Matches, "tele");
    responseObject[team].last3End = avg(last3Matches, "end");
    responseObject[team].last3EPA = avg(last3Matches, "epa");
  });
}
