import { ProgressBar, StatusBadge, Controls } from '@components';

export const HomeScreen = () => {
    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
        }}>
            <div style={{
                width: '100%',
                maxWidth: '440px',
                backgroundColor: '#1e293b',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        letterSpacing: '-0.025em',
                        margin: 0,
                        background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        Game Station
                    </h1>
                    <StatusBadge status="PLAYING" />
                </div>

                <ProgressBar progress={75} />

                <Controls
                    status="IDLE"
                    loading={false}
                    onPrepare={() => {}}
                    onLaunch={() => {}}
                    onStop={() => {}}
                />
            </div>
        </div>
    );
};