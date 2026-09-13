// ---------------------------------------------------------------------------
// All résumé content lives here. Everything the world renders is derived from
// this file, so updating the CV is a single-file edit.
// ---------------------------------------------------------------------------

export const PROFILE = {
  name: 'Mark Yasser Nabil',
  short: 'MARK YASSER',
  title: 'Software Engineer',
  tagline: 'Backend • Distributed Systems • Cloud',
  location: 'Cairo, Egypt',
  phone: '+20 120 2984 272',
  email: 'markyasser2011@gmail.com',
  github: 'https://github.com/markyasser',
  linkedin: 'https://www.linkedin.com/in/mark-yasser-2525711b6/',
  summary:
    'Backend Software Engineer specializing in distributed systems and microservices architecture. Skilled in data migration, cloud infrastructure (AWS, Terraform), and testing across the full software development lifecycle, with a proven record of improving performance, cutting costs, and mentoring engineers.',
}

// Headline numbers, shown as roadside stat markers.
export const STATS = [
  { value: '10', label: 'microservices', detail: 'carved out of one monolith' },
  { value: '95%', label: 'latency cut', detail: 'reporting, via ClickHouse' },
  { value: '30%', label: 'cloud cost cut', detail: 'infra consolidation' },
  { value: '60%', label: 'traffic cut', detail: 'polling → Socket.IO' },
]

export const EXPERIENCE = [
  {
    id: 'prepit',
    company: 'Prepit',
    logo: 'prepit',
    role: 'Software Engineer',
    period: 'Mar 2025 — Present',
    place: 'Cairo, Egypt',
    accent: 0xef6f5c,
    floors: 5,
    bullets: [
      'Co-designed and executed the migration from a monolithic platform to a distributed architecture of 10 independently deployable microservices — defining service boundaries, migration strategy, and core architectural decisions to improve scalability, maintainability, and engineering velocity.',
      'Led the migration of millions of production records from a shared database into service-specific databases by designing scalable migration pipelines that preserved 100% data integrity while minimizing operational disruption.',
      'Designed and provisioned cloud infrastructure using Terraform across 2 AWS regions and 3 environments (dev, staging, production) — enabling automated infrastructure management, secure multi-region connectivity, and repeatable production deployments.',
      'Optimized analytical workloads using ClickHouse, reducing reporting latency by 95% (from tens of seconds to milliseconds) through query optimization and data model improvements.',
      "Designed, implemented, and owned the company's centralized authentication platform using Keycloak, providing Single Sign-On (SSO) and unified identity management across internal services.",
      'Reduced cloud infrastructure costs by 30% through infrastructure consolidation and architectural improvements while maintaining service isolation and developer productivity.',
      'Owned the end-to-end development, testing, deployment, and Google Play release of a production Kotlin application that proxies receipt printers using Socket.IO — replacing continuous polling with real-time communication to cut backend traffic by 60%.',
      'Established engineering quality standards: thousands of automated unit, integration, end-to-end and Pact contract tests, GitHub Actions CI/CD pipelines, and mentoring 3 newly hired engineers and interns through onboarding, code reviews and technical guidance.',
    ],
    tags: ['Microservices', 'Terraform', 'AWS', 'ClickHouse', 'Keycloak', 'Kotlin', 'Pact'],
  },
  {
    id: 'cairo-ta',
    company: 'Faculty of Engineering, Cairo University',
    logo: 'cairo',
    role: 'Teaching Assistant',
    period: 'Feb 2025 — May 2025',
    place: 'Cairo, Egypt',
    accent: 0x2fb3a3,
    floors: 3,
    bullets: [
      'Taught object-oriented programming (OOP) and software engineering fundamentals in C++ to 40+ students across lab sessions over a full semester.',
      'Collaborated with faculty members to improve course material and programming assignments.',
    ],
    tags: ['C++', 'OOP', 'Teaching'],
  },
  {
    id: 'gameball',
    company: 'Gameball',
    logo: 'gameball',
    role: 'Backend Intern',
    period: 'Jul 2024 — Sep 2024',
    place: 'Cairo, Egypt',
    accent: 0xf5b942,
    floors: 2,
    bullets: [
      'Improved API performance by implementing an in-memory caching layer in ASP.NET Core, reducing response latency by approximately 5%.',
      'Migrated image assets to WebP format and automated asset management on AWS S3.',
    ],
    tags: ['ASP.NET Core', 'Caching', 'AWS S3'],
  },
]

export const EDUCATION = {
  id: 'education',
  school: 'Cairo University',
  degree: 'B.Sc. Computer Engineering',
  grade: 'Excellent with Honors',
  period: '2019 — 2024',
  place: 'Cairo, Egypt',
}

// Skill groups — each group becomes a stack of smashable crates in the yard.
export const SKILL_GROUPS = [
  { id: 'languages', label: 'Programming Languages', color: 0xef6f5c,
    items: ['JavaScript', 'Java', 'C#', 'Python', 'Kotlin', 'SQL', 'C++'] },
  { id: 'backend', label: 'Backend', color: 0x2fb3a3,
    items: ['Node.js', 'Express.js', 'ASP.NET Core', 'Spring Boot', 'REST APIs', 'Socket.IO'] },
  { id: 'architecture', label: 'Architecture', color: 0x7a6cf0,
    items: ['Microservices', 'Distributed Systems', 'Event-Driven', 'System Design'] },
  { id: 'cloud', label: 'Cloud & DevOps', color: 0xf5b942,
    items: ['AWS', 'Terraform', 'Docker', 'GitHub Actions', 'CI/CD'] },
  { id: 'databases', label: 'Databases', color: 0x3f8ede,
    items: ['PostgreSQL', 'ClickHouse', 'SQL Server', 'MySQL', 'MongoDB'] },
  { id: 'identity', label: 'Identity & Security', color: 0xe2649b,
    items: ['Keycloak', 'SSO', 'OAuth2', 'Identity Mgmt'] },
  { id: 'frontend', label: 'Frontend', color: 0x4fc3a1,
    items: ['React', 'Next.js', 'Flutter'] },
  { id: 'testing', label: 'Testing', color: 0xff9068,
    items: ['Unit', 'Integration', 'End-to-End', 'Pact Contract'] },
  { id: 'practices', label: 'Practices', color: 0x8aa0b8,
    items: ['Agile', 'Scrum', 'Post-Mortems', 'Code Review', 'Mentoring'] },
]

// Spoken languages. These are NOT in the PDF CV — Arabic and English follow
// from living in Cairo and working in English, but set the levels (and add or
// remove a language) to match reality. An empty level renders the flag and the
// name with no claim attached.
export const LANGUAGES = [
  { language: 'Arabic', code: 'eg', level: 'Native' },
  { language: 'English', code: 'gb', level: 'Professional' },
  { language: 'French', code: 'fr', level: '' },
]

export const CONTACT_LINKS = [
  { id: 'github', label: 'GitHub', sub: '@markyasser', href: PROFILE.github, color: 0x22304a },
  { id: 'linkedin', label: 'LinkedIn', sub: 'mark-yasser', href: PROFILE.linkedin, color: 0x0a66c2 },
  { id: 'email', label: 'Email', sub: PROFILE.email, href: `mailto:${PROFILE.email}`, color: 0xef6f5c },
]

// Hidden pickups scattered across the map.
export const SHARD_FACTS = [
  'Migrated millions of production rows with 100% data integrity.',
  'Terraform across 2 AWS regions × 3 environments.',
  'ClickHouse took reporting from tens of seconds to milliseconds.',
  'Keycloak SSO — one identity across every internal service.',
  'Thousands of automated tests: unit → integration → e2e → Pact.',
  'Shipped a Kotlin printer proxy to Google Play.',
  'Socket.IO replaced polling and cut backend traffic by 60%.',
  'Mentored 3 engineers through onboarding and code review.',
  'Taught C++ and OOP to 40+ Cairo University students.',
  'Graduated Computer Engineering — Excellent with Honors.',
]
