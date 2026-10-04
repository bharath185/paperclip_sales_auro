async function run() {
  const compRes = await fetch('http://localhost:3100/api/companies');
  const companies = await compRes.json();
  const company = companies[0];
  console.log('Target Company:', company.id, '(' + company.name + ')');

  // 1. Create a 100-lead Outbound Campaign
  const createRes = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bengaluru Industrial Realtime Outbound - 100 Accounts',
      industry: 'Manufacturing & Engineering',
      subSegment: 'Precision CNC, Tooling, Aerospace & Auto Components',
      location: 'Bengaluru Industrial Corridors (Peenya, Bommasandra, Bidadi, Whitefield, Jigani)',
      companySize: '50-500',
      targetTitles: ['VP of Manufacturing Operations', 'Plant General Manager', 'Head of Tooling Engineering', 'Managing Director', 'Chief Technology Officer'],
      offerProposition: 'Autonomous real-time production analytics and zero-defect QA telemetry.',
      callToAction: 'Can we schedule a 10-minute briefing next week to show you how our system eliminates machining defects?',
      dailyLeadQuota: 100,
      isDemo: true,
      complianceSettings: {
        dryRun: true,
        requireHumanApproval: true,
        perDomainHourlyLimit: 5,
        enableWarmupRamp: true,
      },
    }),
  });
  const campaign = await createRes.json();
  console.log('\n[1] CAMPAIGN CREATED:');
  console.log('  ID:', campaign.id);
  console.log('  Name:', campaign.name);
  console.log('  Target Quota:', campaign.brief.dailyLeadQuota);

  // 2. Trigger Research Stage to generate and score 100 leads
  console.log('\n[2] DISPATCHING AI RESEARCHERS TO GENERATE 100 ACCOUNTS...');
  const resResearch = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/campaigns/${campaign.id}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const researchData = await resResearch.json();
  const leads = researchData.leads || [];
  console.log('  Successfully Discovered & Scored Leads Count:', leads.length);

  // Summary by Sub-Segment
  const segments = {};
  leads.forEach((l) => {
    segments[l.subSegment] = (segments[l.subSegment] || 0) + 1;
  });
  console.log('  Segment Breakdown:', segments);

  // Top 5 High Score Samples
  console.log('\n  Top 5 Qualified Leads:');
  leads.slice(0, 5).forEach((l, idx) => {
    console.log(`   ${idx + 1}. [${l.score}/100] ${l.companyName}`);
    console.log(`      Contact: ${l.decisionMakerName} (${l.decisionMakerTitle})`);
    console.log(`      Email: ${l.email} | Phone: ${l.phone}`);
    console.log(`      Location: ${l.location}`);
  });

  // 3. Get Human Approval Batch
  const appRes = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/campaigns/${campaign.id}/approvals`);
  const batches = await appRes.json();
  const batch = batches[0];
  console.log('\n[3] APPROVAL BATCH INBOX:');
  console.log('  Batch ID:', batch.id);
  console.log('  Leads Awaiting Review:', batch.leads.length);

  // 4. Approve All 100 Leads
  const leadIds = batch.leads.map((l) => l.id);
  const approveRes = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/campaigns/${campaign.id}/approvals/${batch.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvedLeadIds: leadIds }),
  });
  const approvedBatch = await approveRes.json();
  console.log('\n[4] LEAD BATCH APPROVED:');
  console.log('  Status:', approvedBatch.status);
  console.log('  Approved Accounts:', approvedBatch.leads.length);

  // 5. Generate 3-Touch Email Sequence for all 100 leads
  const seqRes = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/campaigns/${campaign.id}/sequence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const seqData = await seqRes.json();
  console.log('\n[5] EMAIL SEQUENCE ENGINE:');
  console.log('  Total Sequence Steps Configured:', seqData.steps.length);
  seqData.steps.forEach((s) => {
    console.log(`   Touch ${s.stepNumber} (Day +${s.delayDays}): "${s.subjectTemplate}"`);
  });

  // 6. Record Simulated Positive Replies (Hot Leads)
  const hotRes1 = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/hot-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignId: campaign.id,
      leadId: leads[0].id,
      companyName: leads[0].companyName,
      contactName: leads[0].decisionMakerName,
      contactEmail: leads[0].email,
      replySnippet: 'We have 40 CNC centers in Peenya Phase 1. Let us talk Wednesday at 11 AM.',
      sentiment: 'meeting_requested',
    }),
  });
  const hot1 = await hotRes1.json();

  const hotRes2 = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/hot-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaignId: campaign.id,
      leadId: leads[1].id,
      companyName: leads[1].companyName,
      contactName: leads[1].decisionMakerName,
      contactEmail: leads[1].email,
      replySnippet: 'Please share your technical whitepaper on AS9100 defect telemetry.',
      sentiment: 'information_requested',
    }),
  });
  const hot2 = await hotRes2.json();

  console.log('\n[6] HOT INBOUND LEADS CAPTURED:');
  console.log(`  1. ${hot1.companyName} (${hot1.contactName}) -> ${hot1.sentiment}`);
  console.log(`     "${hot1.replySnippet}"`);
  console.log(`  2. ${hot2.companyName} (${hot2.contactName}) -> ${hot2.sentiment}`);
  console.log(`     "${hot2.replySnippet}"`);

  // 7. Full CRM Synchronization
  const syncRes = await fetch(`http://localhost:3100/api/companies/${company.id}/sales/campaigns/${campaign.id}/crm-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crmConfig: { provider: 'csv_export', isMock: true } }),
  });
  const syncResult = await syncRes.json();
  console.log('\n[7] CRM SYNCHRONIZATION:');
  console.log('  Accounts Synced to CRM / Export:', syncResult.synced);
}

run().catch(console.error);
