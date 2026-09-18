export const ProgressBar = ({ progress }: { progress: number }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500 }}>
            <span style={{ color: '#94a3b8' }}>Carga del Sistema</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{progress}%</span>
        </div>
        <div style={{
            width: '100%',
            backgroundColor: '#0f172a',
            borderRadius: '9999px',
            height: '10px',
            padding: '2px',
            boxSizing: 'border-box',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
            <div style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
                height: '100%',
                borderRadius: '9999px',
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.5)'
            }} />
        </div>
    </div>
);