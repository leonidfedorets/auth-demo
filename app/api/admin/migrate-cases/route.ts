import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(req: NextRequest) {
  const deploySecret = process.env.DEPLOY_SECRET;
  const authHeader = req.headers.get("x-deploy-secret");
  const isBootstrap = !deploySecret || authHeader === deploySecret;
  if (!isBootstrap) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const results: string[] = [];

  // ── Schema ────────────────────────────────────────────────────────────────
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS case_types (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        department   TEXT NOT NULL,
        approval_required BOOLEAN NOT NULL DEFAULT false,
        trigger_type TEXT NOT NULL DEFAULT 'manual',
        version      INT  NOT NULL DEFAULT 1,
        active       BOOLEAN NOT NULL DEFAULT true,
        tenant_id    UUID,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    results.push("case_types: ok");
  } catch (e) { results.push(`case_types: ${e}`); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS case_type_fields (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_type_id    TEXT NOT NULL REFERENCES case_types(id) ON DELETE CASCADE,
        field_key       TEXT NOT NULL,
        label           TEXT NOT NULL,
        field_type      TEXT NOT NULL,
        required_at     TEXT NOT NULL DEFAULT 'optional',
        options         JSONB NOT NULL DEFAULT '[]',
        active          BOOLEAN NOT NULL DEFAULT true,
        conditional_on  JSONB,
        sort_order      INT NOT NULL DEFAULT 0
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_ctf_type ON case_type_fields(case_type_id)`;
    results.push("case_type_fields: ok");
  } catch (e) { results.push(`case_type_fields: ${e}`); }

  try {
    await sql`CREATE SEQUENCE IF NOT EXISTS case_number_seq START 2848`;
    results.push("case_number_seq: ok");
  } catch (e) { results.push(`case_number_seq: ${e}`); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS cases (
        id            TEXT PRIMARY KEY,
        type_id       TEXT REFERENCES case_types(id),
        client_id     TEXT,
        client_name   TEXT,
        department    TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'new',
        assignee      TEXT,
        reporter      TEXT NOT NULL,
        initiation    TEXT NOT NULL DEFAULT 'manual',
        trigger       TEXT,
        license       TEXT NOT NULL,
        sla_due_at    DATE,
        sla_breached  BOOLEAN NOT NULL DEFAULT false,
        description   TEXT,
        resolution    TEXT,
        reject_reason TEXT,
        custom_fields JSONB NOT NULL DEFAULT '{}',
        batch_id      TEXT,
        transaction_id TEXT,
        external_refs JSONB NOT NULL DEFAULT '[]',
        tenant_id     UUID,
        closed_at     TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_cases_tenant ON cases(tenant_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cases_dept ON cases(department)`;
    results.push("cases: ok");
  } catch (e) { results.push(`cases: ${e}`); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS case_approvers (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id     TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        role        TEXT,
        status      TEXT NOT NULL DEFAULT 'pending',
        comment     TEXT,
        resolved_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_ca_case ON case_approvers(case_id)`;
    results.push("case_approvers: ok");
  } catch (e) { results.push(`case_approvers: ${e}`); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS case_comments (
        id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id   TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        author    TEXT NOT NULL,
        body      TEXT NOT NULL,
        is_system BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_cc_case ON case_comments(case_id)`;
    results.push("case_comments: ok");
  } catch (e) { results.push(`case_comments: ${e}`); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS case_attachments (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id     TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        size        TEXT,
        uploaded_by TEXT,
        source      TEXT,
        tags        JSONB NOT NULL DEFAULT '[]',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_catt_case ON case_attachments(case_id)`;
    results.push("case_attachments: ok");
  } catch (e) { results.push(`case_attachments: ${e}`); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS case_audit (
        id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id   TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
        actor     TEXT NOT NULL,
        action    TEXT NOT NULL,
        field     TEXT,
        old_val   TEXT,
        new_val   TEXT,
        context   TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_caud_case ON case_audit(case_id)`;
    results.push("case_audit: ok");
  } catch (e) { results.push(`case_audit: ${e}`); }

  // ── Seed case types ───────────────────────────────────────────────────────
  const caseTypes = [
    { id:"ct1", name:"KYB Review",         department:"Onboarding",  approval_required:true,  trigger_type:"manual", version:3 },
    { id:"ct2", name:"AML / TM Alert",     department:"AML",         approval_required:true,  trigger_type:"auto",   version:2 },
    { id:"ct3", name:"Fraud Investigation",department:"Fraud",       approval_required:true,  trigger_type:"auto",   version:1 },
    { id:"ct4", name:"Provider Recall",    department:"Settlements", approval_required:false, trigger_type:"manual", version:1 },
    { id:"ct5", name:"Precheck",           department:"Compliance",  approval_required:false, trigger_type:"manual", version:2 },
    { id:"ct6", name:"Transaction Review", department:"Compliance",  approval_required:false, trigger_type:"auto",   version:1 },
  ];
  for (const ct of caseTypes) {
    try {
      await sql`
        INSERT INTO case_types (id, name, department, approval_required, trigger_type, version)
        VALUES (${ct.id}, ${ct.name}, ${ct.department}, ${ct.approval_required}, ${ct.trigger_type}, ${ct.version})
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, version=EXCLUDED.version, updated_at=NOW()
      `;
    } catch (e) { results.push(`seed ct ${ct.id}: ${e}`); }
  }
  results.push("case_types seeded: ok");

  const typeFields: Array<{case_type_id:string;field_key:string;label:string;field_type:string;required_at:string;options:string[];sort_order:number;conditional_on:string|null}> = [
    {case_type_id:"ct1",field_key:"review_scope",label:"Review Scope",field_type:"dropdown",required_at:"create",options:["Full KYB","Enhanced DD","Periodic Review"],sort_order:0,conditional_on:null},
    {case_type_id:"ct1",field_key:"risk_rating",label:"Risk Rating",field_type:"dropdown",required_at:"complete",options:["Low","Medium","High","Unacceptable"],sort_order:1,conditional_on:null},
    {case_type_id:"ct1",field_key:"pep_confirmed",label:"PEP Confirmed",field_type:"boolean",required_at:"optional",options:[],sort_order:2,conditional_on:null},
    {case_type_id:"ct1",field_key:"notes",label:"Internal Notes",field_type:"textarea",required_at:"optional",options:[],sort_order:3,conditional_on:null},
    {case_type_id:"ct2",field_key:"alert_type",label:"Alert Type",field_type:"dropdown",required_at:"create",options:["Structuring","Unusual Velocity","High-Risk Country","PEP Transaction"],sort_order:0,conditional_on:null},
    {case_type_id:"ct2",field_key:"alert_id",label:"Alert ID (TM System)",field_type:"text",required_at:"create",options:[],sort_order:1,conditional_on:null},
    {case_type_id:"ct2",field_key:"transaction_ids",label:"Transaction IDs",field_type:"textarea",required_at:"create",options:[],sort_order:2,conditional_on:null},
    {case_type_id:"ct2",field_key:"disposition",label:"Disposition",field_type:"dropdown",required_at:"complete",options:["SAR Filed","No Action","Enhanced Monitoring"],sort_order:3,conditional_on:null},
    {case_type_id:"ct3",field_key:"fraud_type",label:"Fraud Type",field_type:"dropdown",required_at:"create",options:["Account Takeover","Payment Fraud","Identity Fraud","Chargeback"],sort_order:0,conditional_on:null},
    {case_type_id:"ct3",field_key:"amount",label:"Amount (EUR)",field_type:"number",required_at:"create",options:[],sort_order:1,conditional_on:null},
    {case_type_id:"ct3",field_key:"outcome",label:"Outcome",field_type:"dropdown",required_at:"complete",options:["Funds Recovered","Reported to Authorities","No Recovery","Monitoring"],sort_order:2,conditional_on:null},
    {case_type_id:"ct4",field_key:"recall_reason",label:"Recall Reason",field_type:"dropdown",required_at:"create",options:["Duplicate","Incorrect Beneficiary","Client Request","Compliance Hold","Other"],sort_order:0,conditional_on:null},
    {case_type_id:"ct4",field_key:"recall_reason_other",label:"Other Reason Detail",field_type:"text",required_at:"create",options:[],sort_order:1,conditional_on:JSON.stringify({key:"recall_reason",value:"Other"})},
    {case_type_id:"ct4",field_key:"amount",label:"Amount (EUR)",field_type:"number",required_at:"create",options:[],sort_order:2,conditional_on:null},
    {case_type_id:"ct5",field_key:"entity_type",label:"Entity Type",field_type:"dropdown",required_at:"create",options:["Individual","Corporate"],sort_order:0,conditional_on:null},
    {case_type_id:"ct5",field_key:"registration_number",label:"Registration Number",field_type:"text",required_at:"create",options:[],sort_order:1,conditional_on:null},
    {case_type_id:"ct5",field_key:"jurisdiction",label:"Jurisdiction",field_type:"text",required_at:"create",options:[],sort_order:2,conditional_on:null},
    {case_type_id:"ct6",field_key:"transaction_id",label:"Transaction ID",field_type:"text",required_at:"create",options:[],sort_order:0,conditional_on:null},
    {case_type_id:"ct6",field_key:"review_reason",label:"Review Reason",field_type:"dropdown",required_at:"create",options:["High Value","Unusual Pattern","Country Flag","Manual Trigger"],sort_order:1,conditional_on:null},
    {case_type_id:"ct6",field_key:"outcome",label:"Review Outcome",field_type:"dropdown",required_at:"complete",options:["Approved","Declined","Escalated to AML","Monitoring"],sort_order:2,conditional_on:null},
  ];
  for (const f of typeFields) {
    try {
      await sql`
        INSERT INTO case_type_fields (case_type_id, field_key, label, field_type, required_at, options, sort_order, conditional_on)
        VALUES (${f.case_type_id}, ${f.field_key}, ${f.label}, ${f.field_type}, ${f.required_at}, ${JSON.stringify(f.options)}, ${f.sort_order}, ${f.conditional_on})
        ON CONFLICT DO NOTHING
      `;
    } catch (e) { results.push(`seed field ${f.field_key}: ${e}`); }
  }
  results.push("case_type_fields seeded: ok");

  // ── Seed cases ────────────────────────────────────────────────────────────
  const seedCases = [
    {id:"CS-2847",type_id:"ct2",client_id:"MCH-2847",client_name:"FinTech Solutions Ltd",department:"AML",status:"pending_approval",assignee:"Sarah K.",reporter:"System",initiation:"auto",trigger:"tm_velocity_alert",license:"UK",sla_due_at:"2026-07-04",description:"Automated TM alert — unusual velocity pattern detected. Three transactions above structuring threshold within 24h window.",resolution:"SAR filed with NCA ref UK-2026-0847.",custom_fields:{alert_type:"Structuring",alert_id:"TM-88421",transaction_ids:"TXN-9001, TXN-9002, TXN-9003",disposition:"SAR Filed"},external_refs:["Zoho TKT-8842"],transaction_id:"TXN-9001",created_at:"2026-07-01 09:00",updated_at:"2026-07-02 15:00"},
    {id:"CS-2846",type_id:"ct1",client_id:"MCH-2289",client_name:"CryptoExchange GmbH",department:"Onboarding",status:"rfi",assignee:"Tom B.",reporter:"Tom B.",initiation:"manual",trigger:null,license:"MT",sla_due_at:"2026-07-06",description:"Periodic KYB review — annual cycle. Client failed to provide updated UBO documentation.",resolution:null,custom_fields:{review_scope:"Periodic Review",risk_rating:"",pep_confirmed:false},external_refs:["Zoho TKT-8831"],transaction_id:null,created_at:"2026-06-28 10:00",updated_at:"2026-07-01 16:30"},
    {id:"CS-2845",type_id:"ct3",client_id:"MCH-2100",client_name:"RetailHub Ltd",department:"Fraud",status:"active",assignee:"Maria L.",reporter:"System",initiation:"auto",trigger:"chargeback_threshold",license:"UK",sla_due_at:"2026-07-05",description:"Chargeback ratio exceeded 1.5% threshold. Automated case for fraud investigation.",resolution:null,custom_fields:{fraud_type:"Chargeback",amount:"12400"},external_refs:[],transaction_id:null,created_at:"2026-07-01 14:00",updated_at:"2026-07-01 14:00"},
    {id:"CS-2844",type_id:"ct4",client_id:"MCH-2200",client_name:"PayDirect Sp. z o.o.",department:"Settlements",status:"new",assignee:null,reporter:"Anna W.",initiation:"manual",trigger:null,license:"CA",sla_due_at:"2026-07-08",description:"Client requesting recall of EUR 4,500 payment sent to incorrect beneficiary.",resolution:null,custom_fields:{recall_reason:"Incorrect Beneficiary",amount:"4500"},external_refs:[],transaction_id:null,created_at:"2026-07-02 08:45",updated_at:"2026-07-02 08:45"},
    {id:"CS-2843",type_id:"ct6",client_id:"MCH-2847",client_name:"FinTech Solutions Ltd",department:"Compliance",status:"closed",assignee:"Sarah K.",reporter:"System",initiation:"auto",trigger:"high_value_flag",license:"UK",sla_due_at:"2026-06-30",description:"High-value single transaction flagged for review. EUR 98,000 SEPA transfer.",resolution:"Transaction reviewed and approved. Consistent with documented business activity.",custom_fields:{transaction_id:"TXN-8812",review_reason:"High Value",outcome:"Approved"},external_refs:[],transaction_id:"TXN-8812",closed_at:"2026-06-30 17:00",created_at:"2026-06-29 11:00",updated_at:"2026-06-30 17:00"},
    {id:"CS-2842",type_id:"ct5",client_id:null,client_name:"(Pre-registration)",department:"Compliance",status:"complete",assignee:"Tom B.",reporter:"Tom B.",initiation:"manual",trigger:null,license:"UK",sla_due_at:"2026-07-05",description:"Pre-registration check for FintechStart GmbH, reg DE-88421. Potential PEP link identified.",resolution:null,custom_fields:{entity_type:"Corporate",registration_number:"DE-88421",jurisdiction:"Germany"},external_refs:[],transaction_id:null,created_at:"2026-07-01 13:00",updated_at:"2026-07-02 09:00"},
    {id:"CS-2841",type_id:"ct2",client_id:"MCH-2150",client_name:"NordShop AB",department:"AML",status:"closed",assignee:"Maria L.",reporter:"System",initiation:"auto",trigger:"high_risk_country",license:"MT",sla_due_at:"2026-06-25",description:"Transaction to high-risk jurisdiction detected. Automated alert.",resolution:"No action. Transaction consistent with known supplier relationship.",custom_fields:{alert_type:"High-Risk Country",alert_id:"TM-87901",transaction_ids:"TXN-8790",disposition:"No Action"},external_refs:[],transaction_id:null,closed_at:"2026-06-25 14:10",created_at:"2026-06-24 10:00",updated_at:"2026-06-25 14:10"},
    {id:"CS-2840",type_id:"ct1",client_id:"MCH-2847",client_name:"FinTech Solutions Ltd",department:"Onboarding",status:"closed",assignee:"Tom B.",reporter:"Tom B.",initiation:"manual",trigger:null,license:"UK",sla_due_at:"2026-06-20",description:"Annual KYB review — full cycle.",resolution:"KYB completed. Risk rating: High (Licence Required override). Approved for continued relationship.",custom_fields:{review_scope:"Full KYB",risk_rating:"High",pep_confirmed:false,notes:"Licence Required override active."},external_refs:[],transaction_id:null,closed_at:"2026-06-18 12:30",created_at:"2026-06-10 09:00",updated_at:"2026-06-18 12:30"},
  ];

  for (const c of seedCases) {
    try {
      await sql`
        INSERT INTO cases (id, type_id, client_id, client_name, department, status, assignee, reporter, initiation, trigger, license, sla_due_at, description, resolution, custom_fields, external_refs, transaction_id, closed_at, created_at, updated_at)
        VALUES (
          ${c.id}, ${c.type_id}, ${c.client_id??null}, ${c.client_name}, ${c.department}, ${c.status},
          ${c.assignee??null}, ${c.reporter}, ${c.initiation}, ${c.trigger??null}, ${c.license},
          ${c.sla_due_at??null}, ${c.description}, ${c.resolution??null},
          ${JSON.stringify(c.custom_fields)}, ${JSON.stringify(c.external_refs)},
          ${c.transaction_id??null}, ${'closed_at' in c && c.closed_at ? c.closed_at : null},
          ${c.created_at}, ${c.updated_at}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (e) { results.push(`seed case ${c.id}: ${e}`); }
  }
  results.push("cases seeded: ok");

  // Seed approvers for CS-2847
  const approversSeed = [
    {case_id:"CS-2847",name:"Maria L.",role:"Head of AML",status:"approved",resolved_at:"2026-07-02 15:00"},
    {case_id:"CS-2847",name:"MLRO",role:"MLRO",status:"pending",resolved_at:null},
    {case_id:"CS-2846",name:"Head of Compliance",role:"Head of Compliance",status:"pending",resolved_at:null},
    {case_id:"CS-2845",name:"Head of Fraud",role:"Head of Fraud",status:"pending",resolved_at:null},
    {case_id:"CS-2841",name:"Maria L.",role:"Head of AML",status:"approved",resolved_at:"2026-06-25 14:00"},
    {case_id:"CS-2840",name:"Head of Compliance",role:"Head of Compliance",status:"approved",resolved_at:"2026-06-18 12:00"},
  ];
  for (const a of approversSeed) {
    try {
      await sql`
        INSERT INTO case_approvers (case_id, name, role, status, resolved_at)
        VALUES (${a.case_id}, ${a.name}, ${a.role}, ${a.status}, ${a.resolved_at??null})
        ON CONFLICT DO NOTHING
      `;
    } catch (e) { results.push(`seed approver: ${e}`); }
  }
  results.push("case_approvers seeded: ok");

  // Seed comments for CS-2847
  const commentsSeed = [
    {case_id:"CS-2847",author:"Sarah K.",body:"Opening this case per TM system alert. Initial review shows structuring pattern across 3 transactions.",is_system:false,created_at:"2026-07-01 09:20"},
    {case_id:"CS-2847",author:"System",body:"RFI created → Zoho TKT-8842. SLA paused.",is_system:true,created_at:"2026-07-01 11:30"},
    {case_id:"CS-2847",author:"Tom B.",body:"CC'd on this. Please flag if SAR needed before EOD.",is_system:false,created_at:"2026-07-01 12:45"},
    {case_id:"CS-2847",author:"System",body:"Zoho reply received. SLA resumed.",is_system:true,created_at:"2026-07-02 10:05"},
    {case_id:"CS-2847",author:"Sarah K.",body:"Client explanation is not satisfactory. Proceeding with SAR filing.",is_system:false,created_at:"2026-07-02 14:15"},
  ];
  for (const c of commentsSeed) {
    try {
      await sql`
        INSERT INTO case_comments (case_id, author, body, is_system, created_at)
        VALUES (${c.case_id}, ${c.author}, ${c.body}, ${c.is_system}, ${c.created_at})
        ON CONFLICT DO NOTHING
      `;
    } catch (e) { results.push(`seed comment: ${e}`); }
  }
  results.push("case_comments seeded: ok");

  // Seed attachments for CS-2847
  const attachSeed = [
    {case_id:"CS-2847",name:"transaction_export_2026-06.xlsx",size:"245 KB",uploaded_by:"System",source:"Auto-attached",tags:["tm"]},
    {case_id:"CS-2847",name:"client_explanation_letter.pdf",size:"128 KB",uploaded_by:"System",source:"client via Zoho",tags:["rfi","zoho"]},
    {case_id:"CS-2847",name:"sar_draft_v2.docx",size:"89 KB",uploaded_by:"Sarah K.",source:"Manual upload",tags:[]},
  ];
  for (const a of attachSeed) {
    try {
      await sql`
        INSERT INTO case_attachments (case_id, name, size, uploaded_by, source, tags)
        VALUES (${a.case_id}, ${a.name}, ${a.size}, ${a.uploaded_by}, ${a.source}, ${JSON.stringify(a.tags)})
        ON CONFLICT DO NOTHING
      `;
    } catch (e) { results.push(`seed attachment: ${e}`); }
  }
  results.push("case_attachments seeded: ok");

  // Seed audit for CS-2847
  const auditSeed = [
    {case_id:"CS-2847",actor:"System",action:"Case Created",field:"status",old_val:"—",new_val:"new",context:"initiation=auto",created_at:"2026-07-01 09:00"},
    {case_id:"CS-2847",actor:"Sarah K.",action:"Assigned",field:"assignee",old_val:"—",new_val:"Sarah K.",context:null,created_at:"2026-07-01 09:15"},
    {case_id:"CS-2847",actor:"System",action:"Status Changed",field:"status",old_val:"new",new_val:"active",context:null,created_at:"2026-07-01 09:15"},
    {case_id:"CS-2847",actor:"Sarah K.",action:"RFI Sent",field:"status",old_val:"active",new_val:"rfi",context:"Zoho TKT-8842",created_at:"2026-07-01 11:30"},
    {case_id:"CS-2847",actor:"System",action:"RFI Response Received",field:"status",old_val:"rfi",new_val:"active",context:"SLA resumed",created_at:"2026-07-02 10:05"},
    {case_id:"CS-2847",actor:"Sarah K.",action:"Field Updated",field:"disposition",old_val:"—",new_val:"SAR Filed",context:null,created_at:"2026-07-02 14:20"},
    {case_id:"CS-2847",actor:"Sarah K.",action:"Decision: Complete",field:"status",old_val:"active",new_val:"pending_approval",context:null,created_at:"2026-07-02 14:25"},
    {case_id:"CS-2847",actor:"Maria L.",action:"Approval",field:"approver",old_val:"pending",new_val:"approved",context:null,created_at:"2026-07-02 15:00"},
  ];
  for (const a of auditSeed) {
    try {
      await sql`
        INSERT INTO case_audit (case_id, actor, action, field, old_val, new_val, context, created_at)
        VALUES (${a.case_id}, ${a.actor}, ${a.action}, ${a.field}, ${a.old_val}, ${a.new_val}, ${a.context??null}, ${a.created_at})
        ON CONFLICT DO NOTHING
      `;
    } catch (e) { results.push(`seed audit: ${e}`); }
  }
  results.push("case_audit seeded: ok");

  // Sync sequence to max existing case number
  try {
    await sql`
      SELECT setval('case_number_seq',
        GREATEST(
          (SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 4) AS INTEGER)), 2847) FROM cases WHERE id ~ '^CS-[0-9]+$'),
          2847
        )
      )
    `;
    results.push("case_number_seq synced: ok");
  } catch (e) { results.push(`case_number_seq sync: ${e}`); }

  return NextResponse.json({ success: true, results });
}

export async function GET() {
  try {
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'case%'
      ORDER BY table_name
    `;
    const counts = await Promise.allSettled([
      sql`SELECT COUNT(*) AS n FROM cases`,
      sql`SELECT COUNT(*) AS n FROM case_types`,
    ]);
    return NextResponse.json({
      tables: tables.rows.map(r => r.table_name),
      cases: counts[0].status === "fulfilled" ? counts[0].value.rows[0].n : "?",
      case_types: counts[1].status === "fulfilled" ? counts[1].value.rows[0].n : "?",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
