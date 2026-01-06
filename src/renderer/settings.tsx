import { createRoot } from 'react-dom/client'
import SettingsPanel from './components/SettingsPanel'
import './index.css'
import './i18n'

function SettingsApp() {
    return (
        <div style={{ width: '100vw', height: '100vh', background: 'transparent' }}>
            <SettingsPanel />
        </div>
    )
}

createRoot(document.getElementById('root')!).render(
    <SettingsApp />,
)

