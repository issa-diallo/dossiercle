import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { OnboardingPage } from './pages/onboarding.js';
import { AgencyActivationPage } from './pages/agency-activation.js';
import './styles/tokens.css';
import './styles/app.css';

export function App() {
  return <BrowserRouter basename="/app"><Routes>
    <Route path="/onboarding" element={<OnboardingPage />} />
    <Route path="/agencies/:id/activation" element={<AgencyActivationPage />} />
    <Route path="*" element={<main id="main" className="shell"><h1>Page indisponible</h1><p>Cette page n’est pas disponible.</p></main>} />
  </Routes></BrowserRouter>;
}
