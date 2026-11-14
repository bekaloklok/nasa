import { Toaster } from 'sonner'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { Nav } from './components/Nav'
import { Tool } from './components/tool/Tool'
import { useClimate } from './lib/useClimate'

export default function App() {
  const climate = useClimate()
  return (
    <>
      <Nav />
      <main>
        <Hero climate={climate.summary} placeName={climate.place.name} />
        <HowItWorks />
        <Tool climate={climate} />
      </main>
      <Footer />
      <Toaster theme="dark" position="bottom-center" />
    </>
  )
}
