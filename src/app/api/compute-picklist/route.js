import { NextResponse } from "next/server";
import { sql } from '@vercel/postgres';
import { tidy, mutate, arrange, desc, mean, select, summarizeAll, summarize, max, groupBy } from '@tidyjs/tidy';
import { calcAuto, calcTele, calcEnd, calcEPA } from "@/util/calculations";

export async function POST(request) {
  const requestBody = await request.json(); // Weight inputs

  let data = await sql`SELECT * FROM sdr2025;`;
  let rows = data.rows;

  function averageField(index) {
    if (['breakdown', 'leave', 'noshow'].includes(index)) return arr => arr.some(row => row[index] === true);
    if (['scoutname', 'generalcomments', 'breakdowncomments', 'defensecomments'].includes(index)) return arr => arr.map(row => row[index]).join(', ');
    const validValues = arr => arr.map(row => row[index]).filter(val => val != null && !isNaN(val));
    return arr => validValues(arr).length > 0 
      ? validValues(arr).reduce((sum, v) => sum + v, 0) / validValues(arr).length 
      : 0;    
  }

  // Pre-process: remove no-shows
  rows = rows.filter(row => !row.noshow);

  // Calculate consistency per team before summarizing
  const teamConsistencyMap = Object.fromEntries(
    tidy(rows, groupBy(['team'], [
      summarize({
        consistency: arr => {
          const uniqueMatches = new Set(arr.map(row => row.match));
          const uniqueBreakdownCount = Array.from(uniqueMatches).filter(match =>
            arr.some(row => row.match === match && row.breakdowncomments && row.breakdowncomments.trim() !== "")
          ).length;
          const breakdownRate = uniqueMatches.size > 0 
            ? (uniqueBreakdownCount / uniqueMatches.size) * 100 
            : 0;

          const epaValues = arr.map(row => row.epa).filter(v => typeof v === 'number' && !isNaN(v));
          const meanVal = epaValues.reduce((a, b) => a + b, 0) / epaValues.length || 0;
          const variance = epaValues.reduce((sum, v) => sum + Math.pow(v - meanVal, 2), 0) / epaValues.length || 0;
          const epaStdDev = Math.sqrt(variance);

          return 100 - (breakdownRate + epaStdDev);
        }
      })
    ])).map(d => [d.team, d.consistency])
  );

  // Group by team + match first
  let teamTable = tidy(rows, groupBy(['team', 'match'], [summarizeAll(averageField)]));

  // Group by team
  teamTable = tidy(teamTable, groupBy(['team'], [summarizeAll(averageField)]));

  // Calculate performance metrics
  teamTable = tidy(teamTable, mutate({
    auto: d => calcAuto({
      autol1success: d.autol1success || 0,
      autol2success: d.autol2success || 0,
      autol3success: d.autol3success || 0,
      autol4success: d.autol4success || 0,
      autoprocessorsuccess: d.autoprocessorsuccess || 0,
      autonetsuccess: d.autonetsuccess || 0,
      leave: d.leave || false,
    }),
    tele: d => calcTele({
      telel1success: d.telel1success || 0,
      telel2success: d.telel2success || 0,
      telel3success: d.telel3success || 0,
      telel4success: d.telel4success || 0,
      teleprocessorsuccess: d.teleprocessorsuccess || 0,
      telenetsuccess: d.telenetsuccess || 0,
      hpsuccess: d.hpsuccess || 0
    }),    
    end: d => calcEnd({
      endlocation: d.endlocation || 0
    }),
    epa: d => calcEPA({
      autol1success: d.autol1success || 0,
      autol2success: d.autol2success || 0,
      autol3success: d.autol3success || 0,
      autol4success: d.autol4success || 0,
      autoprocessorsuccess: d.autoprocessorsuccess || 0,
      autonetsuccess: d.autonetsuccess || 0,
      leave: d.leave || false,
      telel1success: d.telel1success || 0,
      telel2success: d.telel2success || 0,
      telel3success: d.telel3success || 0,
      telel4success: d.telel4success || 0,
      teleprocessorsuccess: d.teleprocessorsuccess || 0,
      telenetsuccess: d.telenetsuccess || 0,
      hpsuccess: d.hpsuccess || 0,
      endlocation: d.endlocation || 0
    }),
    cage: d => {
      const roundedEndLocation = Math.round(d.endlocation ?? 0);
      if (roundedEndLocation === 2) return 6;
      if (roundedEndLocation === 3) return 12;
      return 0;
    },
    consistency: d => teamConsistencyMap[d.team] ?? 0,
    coral: d => {
      const success = (d.autol1success || 0) + (d.autol2success || 0) + (d.autol3success || 0) + (d.autol4success || 0) +
                     (d.telel1success || 0) + (d.telel2success || 0) + (d.telel3success || 0) + (d.telel4success || 0);
      const fail = (d.autol1fail || 0) + (d.autol2fail || 0) + (d.autol3fail || 0) + (d.autol4fail || 0) +
                   (d.telel1fail || 0) + (d.telel2fail || 0) + (d.telel3fail || 0) + (d.telel4fail || 0);
      const totalAttempts = success + fail;
      return totalAttempts > 0 ? (success / totalAttempts) * 100 : 0;
    },
    algae: d => {
      const success = (d.autoprocessorsuccess || 0) + (d.teleprocessorsuccess || 0) +
                      (d.autonetsuccess || 0) + (d.telenetsuccess || 0);
      const fail = (d.autoprocessorfail || 0) + (d.teleprocessorfail || 0) +
                   (d.autonetfail || 0) + (d.telenetfail || 0);
      const totalAttempts = success + fail;
      return totalAttempts > 0 ? (success / totalAttempts) * 100 : 0;
    },
    defense: d => {
      const defensePlayed = d.defenseplayed || 0;
      return defensePlayed > 0 ? defensePlayed * 10 : 0;
    },
  }), select(['team', 'auto', 'tele', 'end', 'epa', 'cage', 'consistency', 'coral', 'algae', 'defense']));

  // Fetch and integrate TBA rankings
  async function getTBARankings() {
    try {
      const response = await fetch(`https://www.thebluealliance.com/api/v3/event/2025mrcmp/rankings`, {
        headers: {
          'X-TBA-Auth-Key': process.env.TBA_AUTH_KEY,
          'Accept': 'application/json'
        }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.rankings.map(team => ({
        teamNumber: team.team_key.replace('frc', ''),
        rank: team.rank
      }));
    } catch (error) {
      console.error('Error fetching TBA rankings:', error);
      return [];
    }
  }

  try {
    const tbaRankings = await getTBARankings();
    teamTable = teamTable.map(teamData => {
      const rankedData = tbaRankings.find(rankedTeam => rankedTeam.teamNumber == teamData.team);
      return { ...teamData, tbaRank: rankedData ? rankedData.rank : -1 };
    });
  } catch (error) {
    console.error('Error updating rankings:', error);
  }

  // Normalize and rank
  const maxes = tidy(teamTable, summarizeAll(max))[0];

  teamTable = tidy(teamTable, mutate({
    auto: d => maxes.auto ? d.auto / maxes.auto : 0,
    tele: d => maxes.tele ? d.tele / maxes.tele : 0,
    end: d => maxes.end ? d.end / maxes.end : 0,
    epa: d => maxes.epa ? d.epa / maxes.epa : 0,
    cage: d => maxes.cage ? d.cage / maxes.cage : 0,
    consistency: d => maxes.consistency ? d.consistency / maxes.consistency : 0,
    coral: d => maxes.coral ? d.coral / maxes.coral : 0,
    algae: d => maxes.algae ? d.algae / maxes.algae : 0,
    defense: d => maxes.defense ? d.defense / maxes.defense : 0,
    score: d => requestBody.reduce((sum, [key, weight]) => {
      const value = d[key] ?? 0;
      return sum + (value * parseFloat(weight));
    }, 0),
  }), arrange(desc('score')));

  return NextResponse.json(teamTable, { status: 200 });
}