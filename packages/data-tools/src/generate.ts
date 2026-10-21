import type { ColumnInfo, Value } from "@rizomadb/driver-api";

export interface GenColumn {
  name: string; kind: ColumnInfo["kind"]; nullable: boolean; primaryKey?: boolean; unique?: boolean; identity?: boolean; hasDefault?: boolean;
  /** Native type, used only to read a length like varchar(50). */
  nativeType?: string;
  /** Allowed parent keys when this column is a foreign key. */
  references?: Value[];
}
export interface GenOptions { seed: number; locale?: "es" | "en"; startAt?: number; nullRate?: number; yearsBack?: number; now?: Date }

/** mulberry32: tiny, fast, reproducible. */
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const D = {
  es: { first: ["Sofía", "Mateo", "Valentina", "Santiago", "Camila", "Sebastián", "Lucía", "Diego", "Martina", "Nicolás", "Isabella", "Andrés", "Paula", "Javier", "Carolina", "Miguel", "Daniela", "Alejandro", "Fernanda", "Gabriel", "Renata", "Tomás", "Julieta", "Emilio"],
    last: ["García", "Rodríguez", "Martínez", "López", "González", "Hernández", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Reyes", "Vargas", "Castro", "Ortiz"],
    city: ["Madrid", "Ciudad de México", "Bogotá", "Lima", "Buenos Aires", "Santiago", "Quito", "Montevideo", "Sevilla", "Guadalajara", "Medellín", "Valencia"], country: ["España", "México", "Colombia", "Perú", "Argentina", "Chile", "Ecuador", "Uruguay"],
    street: ["Calle Mayor", "Avenida Libertad", "Calle del Sol", "Paseo de la Reforma", "Avenida Bolívar", "Calle Real"], company: ["Distribuciones del Sur", "Grupo Andino", "Tecnologías Solana", "Comercial Ibérica", "Servicios Pampa"],
    words: ["rápido", "seguro", "nuevo", "clásico", "premium", "básico", "ligero", "robusto", "digital", "orgánico"], status: ["activo", "pendiente", "cancelado", "completado"] },
  en: { first: ["Olivia", "Liam", "Emma", "Noah", "Ava", "Elijah", "Sophia", "James", "Mia", "Lucas", "Amelia", "Henry", "Grace", "Jack", "Chloe", "Owen", "Ella", "Ryan", "Zoe", "Ethan", "Hannah", "Caleb", "Ruby", "Leo"],
    last: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Clark", "Lewis", "Walker", "Hall"],
    city: ["London", "New York", "Toronto", "Sydney", "Dublin", "Chicago", "Austin", "Seattle", "Manchester", "Boston", "Denver", "Portland"], country: ["United Kingdom", "United States", "Canada", "Australia", "Ireland", "New Zealand"],
    street: ["Main Street", "Oak Avenue", "Maple Road", "Park Lane", "High Street", "Cedar Court"], company: ["Northwind Traders", "Acme Supply", "Blue Harbor Ltd", "Summit Works", "Granite Systems"],
    words: ["fast", "secure", "new", "classic", "premium", "basic", "light", "robust", "digital", "organic"], status: ["active", "pending", "cancelled", "completed"] },
};
const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const maxLen = (t?: string) => { const m = /\((\d+)\)/.exec(t ?? ""); return m && /char|text|string/i.test(t ?? "") ? Number(m[1]) : undefined; };

/** Reproducible, constraint-aware rows. Same seed + same columns => identical output. */
export function* generateRows(cols: GenColumn[], count: number, o: GenOptions): Generator<Value[]> {
  const r = rng(o.seed), L = D[o.locale ?? "en"], pick = <T>(a: T[]) => a[Math.floor(r() * a.length)]!;
  const now = (o.now ?? new Date("2026-01-01T00:00:00Z")).getTime(), span = (o.yearsBack ?? 5) * 365 * 86_400_000;
  const nullRate = o.nullRate ?? 0.05, start = o.startAt ?? 1;
  for (let i = 0; i < count; i++) {
    const n = start + i;
    yield cols.map((c): Value => {
      if (c.identity) return n;
      if (c.references) { if (!c.references.length) return null; return c.nullable && r() < nullRate ? null : c.references[Math.floor(r() * c.references.length)]!; }
      const unique = !!(c.primaryKey || c.unique);
      if (c.nullable && !unique && r() < nullRate) return null;
      return cell(c, n, unique);
    });
  }
  function cell(c: GenColumn, n: number, unique: boolean): Value {
    const name = c.name.toLowerCase(), len = maxLen(c.nativeType);
    const fit = (s: string) => (len && s.length > len ? s.slice(0, len) : s);
    const uniq = (s: string, sep = "") => (unique ? `${s}${sep}${n}` : s);
    switch (c.kind) {
      case "integer": if (unique) return n; if (/age|edad/.test(name)) return 18 + Math.floor(r() * 62); if (/year|anio|año/.test(name)) return 2000 + Math.floor(r() * 26); if (/qty|quantity|cantidad|count/.test(name)) return 1 + Math.floor(r() * 20); return Math.floor(r() * 1000);
      case "float": return Math.round(r() * 100000) / 100;
      case "decimal": { const v = /price|precio|amount|total|cost|costo|importe/.test(name) ? 5 + r() * 995 : r() * 100; return v.toFixed(2); }
      case "boolean": return r() < 0.5;
      case "datetime": return new Date(Math.floor((now - r() * span) / 1000) * 1000);
      case "json": return { json: { id: n, tag: pick(L.words) } };
      case "binary": return new Uint8Array([n & 255, (n >> 8) & 255, Math.floor(r() * 256)]);
      default: {
        if (/uuid|guid/.test(name)) return fit(`${hex(r, 8)}-${hex(r, 4)}-4${hex(r, 3)}-a${hex(r, 3)}-${hex(r, 12)}`);
        if (/e-?mail|correo/.test(name)) return fit(`${ascii(pick(L.first))}.${ascii(pick(L.last))}${unique ? n : Math.floor(r() * 100)}@example.com`);
        if (/first.?name|nombre$|^nombre|given/.test(name) && !/full|last|apellido/.test(name)) return fit(uniq(pick(L.first), " "));
        if (/last.?name|surname|apellido/.test(name)) return fit(uniq(pick(L.last), " "));
        if (/^name$|full.?name|nombre.?completo|customer|cliente|author|autor/.test(name)) return fit(uniq(`${pick(L.first)} ${pick(L.last)}`, " "));
        if (/phone|tel|mobile|movil/.test(name)) return fit(`+${10 + Math.floor(r() * 80)} ${Math.floor(100 + r() * 900)} ${Math.floor(1000 + r() * 9000)}`);
        if (/city|ciudad/.test(name)) return fit(pick(L.city));
        if (/country|pais|país/.test(name)) return fit(pick(L.country));
        if (/address|direcci|street|calle/.test(name)) return fit(`${pick(L.street)} ${Math.floor(1 + r() * 200)}`);
        if (/company|empresa|organi/.test(name)) return fit(uniq(pick(L.company), " "));
        if (/url|website|sitio/.test(name)) return fit(`https://www.${ascii(pick(L.company))}.example/${unique ? n : Math.floor(r() * 1000)}`);
        if (/status|estado/.test(name)) return fit(pick(L.status));
        if (/sku|code|codigo|código/.test(name)) return fit(`SKU-${String(n).padStart(6, "0")}`);
        if (/title|subject|asunto|titulo|título|product|producto/.test(name)) return fit(uniq(`${pick(L.words)} ${pick(L.words)}`, " #"));
        if (/desc|comment|note|notas|coment|bio|text|body/.test(name)) return fit(Array.from({ length: 6 + Math.floor(r() * 8) }, () => pick(L.words)).join(" "));
        return fit(uniq(`${pick(L.words)}_${Math.floor(r() * 1000)}`, "_"));
      }
    }
  }
}
const hex = (r: () => number, n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join("");
