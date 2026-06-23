import { z } from 'zod';

const coordinateSchema = z.preprocess((val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.trim().replace(',', '.');
    if (cleaned === '') return NaN;
    return Number(cleaned);
  }
  return NaN;
}, z.number({ message: 'Debe ser un número (use punto para decimales, ej. 6.1719)' }));

const schema = z.object({
  signal_code: z.string().trim().min(1, 'Código requerido'),
  category: z.string().trim().min(1, 'Categoría requerida'),
  latitude: coordinateSchema,
  longitude: coordinateSchema,
});

const tests = [
  { signal_code: 'SE-1', category: 'Preventiva', latitude: '6.1719', longitude: '-75.6062' },
  { signal_code: 'SE-2', category: 'Preventiva', latitude: '6,1719', longitude: '-75,6062' },
  { signal_code: '', category: '', latitude: '', longitude: '' },
  { signal_code: 'SE-3', category: 'Preventiva', latitude: undefined, longitude: undefined },
];

for (const t of tests) {
  const r = schema.safeParse(t);
  console.log(JSON.stringify(t), '=>', r.success ? 'OK' : JSON.stringify(r.error.issues));
}
