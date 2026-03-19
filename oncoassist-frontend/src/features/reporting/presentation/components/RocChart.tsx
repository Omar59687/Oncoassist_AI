import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface RocChartProps {
  fpr: number[];
  tpr: number[];
}

const RocChart: React.FC<RocChartProps> = ({ fpr, tpr }) => {
  // تحويل البيانات لشكل يفهمه Recharts
  const data = fpr.map((val, i) => ({ fpr: val, tpr: tpr[i] }));

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorTpr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
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
          <Area type="monotone" dataKey="tpr" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTpr)" />
          {/* خط المرجعية العشوائي */}
          <Line type="monotone" data={[ {fpr:0, tpr:0}, {fpr:1, tpr:1} ]} dataKey="tpr" stroke="#cbd5e1" strokeDasharray="5 5" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RocChart;
