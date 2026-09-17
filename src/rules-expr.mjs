export const DERIVED_DEFS = [
  {
    key: "unplannedShare",
    expr: { sumFields: { field: "q5_work_breakdown", keys: ["ops", "bugs"] } },
  },
  {
    key: "nonRoadmapShare",
    expr: {
      sumFields: {
        field: "q5_work_breakdown",
        keys: ["ops", "bugs", "regulatory", "tech_debt"],
      },
    },
  },
  {
    key: "volatilityIsHigh",
    expr: { in: [{ answer: "q6_volatility" }, ["high", "interrupt_driven"]] },
  },
  {
    key: "coverageLevel",
    expr: {
      bucket: {
        value: {
          countSelected: {
            field: "q12_quality_gates",
            except: ["mostly_manual"],
          },
        },
        cuts: [
          { lte: 0, then: "low" },
          { lte: 2, then: "partial" },
        ],
        else: "high",
      },
    },
  },
  { key: "teamSize", expr: { answer: "q2_team.total" } },
  {
    key: "hasProductOwner",
    expr: {
      in: [
        { answer: "q2_team.product_owner" },
        ["dedicated", "shared"],
      ],
    },
  },
  {
    key: "hasScrumMaster",
    expr: {
      in: [
        { answer: "q2_team.scrum_master" },
        ["dedicated", "shared"],
      ],
    },
  },
  {
    key: "hasQaSdet",
    expr: { gte: [{ answer: "q2_team.qa_sdet" }, 1] },
  },
];

export const BASE_RULE_EXPRS = [
  {
    id: "base-1",
    when: {
      gte: [{ derived: "nonRoadmapShare" }, 40],
    },
  },
  {
    id: "base-2",
    when: {
      all: [
        { gte: [{ answer: "q5_work_breakdown.roadmap" }, 60] },
        { eq: [{ answer: "q10_architecture" }, "microservices"] },
        { eq: [{ answer: "q7_requirements" }, "structured"] },
        { not: { derived: "volatilityIsHigh" } },
      ],
    },
  },
  {
    id: "base-3",
    when: {
      all: [
        { derived: "hasProductOwner" },
        { derived: "hasScrumMaster" },
        { derived: "hasQaSdet" },
        {
          in: [
            { answer: "q7_requirements" },
            ["high_level", "vague"],
          ],
        },
      ],
    },
  },
  {
    id: "base-4",
    when: {
      all: [
        { lt: [{ derived: "teamSize" }, 5] },
        {
          in: [
            { answer: "q11_deploy_cadence" },
            ["continuous", "sprint"],
          ],
        },
        { eq: [{ answer: "q14_release_autonomy" }, "autonomous"] },
      ],
    },
  },
];

export const OVERLAY_EXPRS = [
  {
    id: "overlay-a",
    when: {
      any: [
        { eq: [{ answer: "q8_compliance" }, "sox_tier1"] },
        { eq: [{ answer: "q15_governance" }, "cab"] },
      ],
    },
  },
  {
    id: "overlay-b",
    when: {
      any: [
        { eq: [{ answer: "q9_precision" }, "zero_tolerance"] },
        {
          rankAtMost: {
            field: "q16_bottlenecks",
            of: "test_fear",
            n: 2,
          },
        },
        { flag: "force_tdd_overlay" },
      ],
    },
  },
  {
    id: "overlay-c",
    when: {
      any: [
        {
          in: [
            { answer: "q14_release_autonomy" },
            ["coupled", "heavy"],
          ],
        },
        { eq: [{ answer: "q3_distribution" }, "global_timezones"] },
      ],
    },
  },
  {
    id: "overlay-d",
    when: {
      any: [
        { eq: [{ answer: "q4_domain_familiarity" }, "low"] },
        { eq: [{ answer: "q7_requirements" }, "vague"] },
        {
          rankAtMost: {
            field: "q16_bottlenecks",
            of: "ambiguous_or_shifting",
            n: 1,
          },
        },
      ],
    },
  },
  {
    id: "overlay-e",
    when: { eq: [{ answer: "q10_architecture" }, "monolith"] },
  },
  {
    id: "overlay-f",
    when: {
      all: [
        {
          any: [
            { eq: [{ answer: "q8_compliance" }, "sox_tier1"] },
            { eq: [{ answer: "q9_precision" }, "zero_tolerance"] },
          ],
        },
        {
          in: [
            { answer: "q21_ci_maturity" },
            ["none", "tests_only"],
          ],
        },
      ],
    },
  },
  {
    id: "overlay-g",
    when: {
      any: [
        { eq: [{ answer: "q19_change_volume" }, "many_small"] },
        { derived: "volatilityIsHigh" },
      ],
    },
  },
];

export const CAUTION_EXPRS = [
  {
    id: "C1",
    when: {
      all: [
        { eq: [{ result: "baseFramework" }, "speckit"] },
        { gte: [{ derived: "nonRoadmapShare" }, 25] },
      ],
    },
  },
  {
    id: "C2",
    when: {
      all: [
        { hasAny: [{ result: "overlays" }, ["overlay-a"]] },
        { eq: [{ answer: "q8_compliance" }, "sox_tier1"] },
      ],
    },
  },
  {
    id: "C3",
    when: {
      all: [
        {
          any: [
            { eq: [{ result: "baseFramework" }, "superpowers"] },
            { hasAny: [{ result: "overlays" }, ["overlay-b"]] },
          ],
        },
        {
          in: [
            { answer: "q18_token_budget" },
            ["individual_pro", "strict"],
          ],
        },
      ],
    },
  },
  {
    id: "C4",
    when: { hasAny: [{ result: "overlays" }, ["overlay-b"]] },
  },
  {
    id: "C5",
    when: {
      all: [
        { eq: [{ result: "baseFramework" }, "openspec"] },
        { eq: [{ answer: "q9_precision" }, "zero_tolerance"] },
      ],
    },
  },
  {
    id: "C6",
    when: {
      all: [
        { hasAny: [{ result: "overlays" }, ["overlay-c"]] },
        { eq: [{ answer: "q8_compliance" }, "sox_tier1"] },
      ],
    },
  },
  {
    id: "C7",
    when: {
      all: [
        {
          in: [
            { result: "baseFramework" },
            ["speckit", "bmad", "superpowers"],
          ],
        },
        { eq: [{ answer: "q19_change_volume" }, "many_small"] },
      ],
    },
  },
  {
    id: "C8",
    when: {
      all: [
        { hasAny: [{ result: "overlays" }, ["overlay-c"]] },
        { lt: [{ derived: "teamSize" }, 3] },
      ],
    },
  },
  {
    id: "C9",
    when: { eq: [{ result: "baseFramework" }, "gsd"] },
  },
  {
    id: "C10",
    when: { eq: [{ result: "baseFramework" }, "superpowers"] },
  },
  {
    id: "C11",
    when: { eq: [{ result: "baseFramework" }, "bmad"] },
  },
  {
    id: "C12",
    when: {
      all: [
        {
          in: [
            { result: "baseFramework" },
            ["speckit", "superpowers", "bmad"],
          ],
        },
        { eq: [{ answer: "q6_volatility" }, "interrupt_driven"] },
      ],
    },
  },
  {
    id: "C13",
    when: { eq: [{ answer: "q14_release_autonomy" }, "vendor"] },
  },
];
