<p align="center">
  <img src="docs/assets/logo.png" width="120" alt="Viprasol Tech logo">
</p>

<h1 align="center">react-data-table</h1>

<p align="center">
  <strong>Sortable, paginated, filterable data table for React.</strong><br>
  Headless-friendly logic (sort / paginate / filter) with a drop-in <code>&lt;DataTable&gt;</code> component.
</p>

<p align="center">
  <em>Built and maintained by <a href="https://viprasol.com">Viprasol Tech</a> — Fintech Experts. Full-Stack Builders.</em>
</p>

<p align="center">
  <a href="https://github.com/Viprasol-Tech/react-data-table/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Viprasol-Tech/react-data-table/ci.yml?style=flat-square&logo=githubactions&logoColor=white&label=CI" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Viprasol-Tech/react-data-table?style=flat-square&color=blue" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <a href="https://t.me/viprasol_help"><img src="https://img.shields.io/badge/Telegram-support-26A5E4?style=flat-square&logo=telegram&logoColor=white" alt="Telegram"></a>
</p>

---

## ✨ Features

- ↕️ **Column sorting** — asc / desc / none, click a header to cycle.
- 📄 **Client-side pagination** — page through large datasets.
- 🔎 **Text filtering** — filter rows by query.
- 🧮 **Tested pure helpers** — `sortRows`, `paginate`, `filterRows`.
- 🔒 **Strictly typed** — TypeScript `strict`, ships `.d.ts`.

## 📦 Install

```bash
npm install react-data-table
```

## 🚀 Usage

```tsx
import { DataTable, type Column } from "react-data-table";

type User = { name: string; age: number };
const columns: Column<User>[] = [
  { key: "name", header: "Name" },
  { key: "age", header: "Age" },
];

export function Demo() {
  const rows: User[] = [{ name: "Ada", age: 36 }, { name: "Linus", age: 54 }];
  return <DataTable columns={columns} rows={rows} pageSize={10} />;
}
```

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

## Contact — Viprasol Tech Private Limited

- 🌐 Website: [viprasol.com](https://viprasol.com)
- ✉️ Email: [support@viprasol.com](mailto:support@viprasol.com)
- 💬 Telegram: [t.me/viprasol_help](https://t.me/viprasol_help) · 📱 WhatsApp: +91 96336 52112
- 🐙 GitHub: [@Viprasol-Tech](https://github.com/Viprasol-Tech) · 💼 [LinkedIn](https://www.linkedin.com/in/viprasol/) · 𝕏 [@viprasol](https://twitter.com/viprasol)

> *Viprasol Tech — fintech software, web & SaaS apps, algorithmic trading systems, and AI agents. Need a custom build? [Get in touch](mailto:support@viprasol.com).*

## License

[MIT](LICENSE) © 2025 Viprasol Tech Private Limited
