import { createRoot } from 'react-dom/client'
import OnboardingPanel from './components/OnboardingPanel'
import './index.css'
import './i18n'

function OnboardingApp() {
    return (
        <div style={{ width: '100vw', height: '100vh', background: 'transparent' }}>
            <OnboardingPanel />
        </div>
    )
}

createRoot(document.getElementById('root')!).render(
    <OnboardingApp />,
)

