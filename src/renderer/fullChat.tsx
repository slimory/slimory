import { createRoot } from 'react-dom/client'
import FullChatPanel from './components/FullChatPanel'
import './index.css'
import './i18n'

function FullChatApp() {
    return (
        <div style={{ width: '100vw', height: '100vh', background: 'transparent' }}>
            <FullChatPanel />
        </div>
    )
}

createRoot(document.getElementById('root')!).render(
    <FullChatApp />,
)

