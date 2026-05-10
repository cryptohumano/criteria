import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PlatformLlmCredentialsCard } from '@/components/workspace/PlatformLlmCredentialsCard'

export default function PlatformLlm() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>IA de plataforma</CardTitle>
          <CardDescription>
            Claves de proveedor (Gemini) usadas por el proxy del servidor para organizaciones sin BYOK.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlatformLlmCredentialsCard />
        </CardContent>
      </Card>
    </div>
  )
}

