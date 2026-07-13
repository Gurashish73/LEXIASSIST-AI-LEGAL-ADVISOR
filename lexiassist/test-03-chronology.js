// test-03-chronology.js
//
// WHAT THIS TESTS: executeExtractCaseChronology end to end, including the
// citation verification logic (verified: true/false per event).
//
// NOTE: your MANDATORY TOOL EXECUTION block in loop/route.ts only forces
// generatePreBriefRisk on the first turn. extractCaseChronology has to be
// separately prompted for — this test does that explicitly as a second
// message rather than assuming the model will infer it's wanted.
//
// WHAT SUCCESS LOOKS LIKE:
//   - caseBrief.aiTimeline is a non-empty array
//   - caseBrief.aiEntities is a non-empty array
//   - At least SOME events have verified: true (if ALL are false, either
//     the model isn't quoting exact source text, or the corpus-building
//     logic in executeExtractCaseChronology has a bug — worth checking
//     server console for the "[CHRONOLOGY] X/Y events failed verification"
//     warning either way)

import { CONFIG, createCase, initSession, continueSession, pollSessionUntilDone, printSection } from './test-config.js';

async function run() {
  printSection('TEST 03: Case Chronology Extraction + Citation Verification');

  const caseBriefId = await createCase('Test Case — Chronology');

  // Turn 1: rich narrative with clear dates/events/parties, deliberately
  // detailed so there's real material for keyEvents + involvedParties
  const sessionId = await initSession({
    prompt:
      'I signed a 12-month lease with my landlord, Mr. Rajesh Sharma, on ' +
      'March 1st 2025 for a corporate office in Connaught Place, Delhi. ' +
      'I paid a security deposit of ₹200,000 at signing. On June 15th 2025, ' +
      'I gave written notice of termination as permitted under clause 8 of ' +
      'the lease. Mr. Sharma acknowledged the notice by email on June 18th ' +
      '2025 but has not returned the deposit as of today, despite the lease ' +
      'requiring return within 30 days of termination.',
    caseBriefId,
  });

  console.log('\n[POLLING] Waiting for turn 1 (risk assessment) to complete...');
  let result = await pollSessionUntilDone(sessionId, { timeoutMs: 60000 });
  console.log(`Turn 1 status: ${result.status}`);

  // Turn 2: explicitly request the chronology, since it's not auto-triggered
  await continueSession({
    sessionId,
    caseBriefId,
    userReply:
      'Can you build a detailed timeline of everything that happened, ' +
      'with exact dates, and list everyone involved?',
  });

  console.log('\n[POLLING] Waiting for turn 2 (chronology extraction) to complete...');
  result = await pollSessionUntilDone(sessionId, { timeoutMs: 60000 });

  console.log('\n--- FINAL SESSION STATE ---');
  console.log(JSON.stringify(result, null, 2));

  const failures = [];
  const timeline = result.caseBrief?.aiTimeline;
  const entities = result.caseBrief?.aiEntities;

  if (result.status !== 'COMPLETED') failures.push(`Expected status COMPLETED, got ${result.status}`);
  if (!Array.isArray(timeline) || timeline.length === 0) failures.push('aiTimeline is empty or not an array — chronology tool likely never fired');
  if (!Array.isArray(entities) || entities.length === 0) failures.push('aiEntities is empty or not an array');

  const verifiedCount = Array.isArray(timeline) ? timeline.filter((e) => e.verified === true).length : 0;
  if (Array.isArray(timeline) && timeline.length > 0 && verifiedCount === 0) {
    failures.push('ALL timeline events have verified: false — citation verification may be broken, or the model is paraphrasing instead of quoting exact source text');
  }

  if (failures.length) {
    console.error('\n\x1b[31m✗ TEST FAILED:\x1b[0m');
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log('\n\x1b[32m✓ TEST 03 PASSED\x1b[0m');
  console.log(`  ${timeline.length} events extracted, ${verifiedCount} verified`);
  console.log(`  Entities: ${entities.join(', ')}`);
}

run().catch((e) => {
  console.error('\x1b[31m✗ CRITICAL ERROR:\x1b[0m', e.message);
  process.exit(1);
});