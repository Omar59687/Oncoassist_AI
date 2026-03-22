import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface RocChartProps {
  fpr: number[];
  tpr: number[];
}

const RocChart: React.FC<RocChartProps> = ({ fpr, tpr }) => {
  const data = fpr.map((val, i) => ({
    fpr: val,
    tpr: tpr[i] ?? 0,
    baseline: val,
  }));

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="fpr" 
            label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -5 }} 
            fontSize={12}
            tick={{fill: '#94a3b8'}}
          />
          <YAxis 
            label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft' }} 
            fontSize={12}
            tick={{fill: '#94a3b8'}}
          />
          <Tooltip />
          <Line type="monotone" dataKey="baseline" stroke="#cbd5e1" strokeDasharray="5 5" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="tpr" stroke="#2563eb" dot={false} strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RocChart;
