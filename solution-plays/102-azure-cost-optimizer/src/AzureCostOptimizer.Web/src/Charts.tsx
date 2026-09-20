import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatCurrency, normalizeChartCoordinates } from './money'

type Props = {
  services: Array<{ name: string; amount: string | number }>
  daily: Array<{ date: string; amount: string | number }>
  currency: string
}

export default function Charts({ services, daily, currency }: Props) {
  const formatMoney = (amount: string | number) => formatCurrency(String(amount), currency)
  const dailyCoordinates = normalizeChartCoordinates(daily.map((item) => String(item.amount)))
  const serviceCoordinates = normalizeChartCoordinates(services.map((service) => String(service.amount)))
  const trend = daily.map((item, index) => ({ label: item.date.slice(5), coordinate: dailyCoordinates[index], amount: item.amount }))
  const allocation = services.slice(0, 8).map((service, index) => ({ ...service, coordinate: serviceCoordinates[index] }))

  return <>
    <div className="chart-region">
      <div className="section-heading"><h2>Daily spend</h2><p>{daily.length} actual daily totals</p></div>
      <div className="chart-frame" aria-label="Spend trend chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs><linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0067B8" stopOpacity={0.28} /><stop offset="100%" stopColor="#0067B8" stopOpacity={0.02} /></linearGradient></defs>
        <CartesianGrid stroke="#E9EEF2" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis hide /><Tooltip formatter={(_, __, item) => formatMoney(String(item.payload.amount))} /><Area type="monotone" dataKey="coordinate" stroke="#0067B8" strokeWidth={2} fill="url(#spendFill)" isAnimationActive={false} />
      </AreaChart></ResponsiveContainer></div>
      <details className="chart-data"><summary>View daily spend data</summary><div className="table-scroll"><table><caption className="sr-only">Daily spend values</caption><thead><tr><th>Date</th><th>Actual cost</th></tr></thead><tbody>
        {daily.map((item) => <tr key={item.date}><td>{item.date}</td><td className="numeric">{formatMoney(item.amount)}</td></tr>)}
      </tbody></table></div></details>
    </div>
    <div className="chart-region">
      <div className="section-heading"><h2>Service allocation</h2><p>{services.length} services</p></div>
      <div className="chart-frame" aria-label="Service allocation chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={allocation} layout="vertical" margin={{ top: 6, right: 12, bottom: 0, left: 16 }}>
        <CartesianGrid stroke="#E9EEF2" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={106} tickLine={false} axisLine={false} /><Tooltip formatter={(_, __, item) => formatMoney(String(item.payload.amount))} /><Bar dataKey="coordinate" fill="#007F73" radius={[0, 3, 3, 0]} isAnimationActive={false} />
      </BarChart></ResponsiveContainer></div>
      <details className="chart-data"><summary>View service allocation data</summary><div className="table-scroll"><table><caption className="sr-only">Service allocation values</caption><thead><tr><th>Service</th><th>Actual cost</th></tr></thead><tbody>
        {services.map((service) => <tr key={service.name}><td>{service.name}</td><td className="numeric">{formatMoney(service.amount)}</td></tr>)}
      </tbody></table></div></details>
    </div>
  </>
}