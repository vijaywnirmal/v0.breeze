"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, RefreshCw, TrendingUp, TrendingDown } from "lucide-react"

interface PortfolioProps {
  credentials: {
    api_key: string
    api_secret: string
    session_token: string
  }
}

export function Portfolio({ credentials }: PortfolioProps) {
  const [holdings, setHoldings] = useState<any>(null)
  const [positions, setPositions] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const fetchHoldings = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("http://localhost:8000/api/holdings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      })

      const data = await response.json()

      if (data.success) {
        setHoldings(data.holdings)
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError("Network error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPositions = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("http://localhost:8000/api/positions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      })

      const data = await response.json()

      if (data.success) {
        setPositions(data.positions)
      } else {
        setError(data.message)
      }
    } catch (error) {
      setError("Network error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHoldings()
    fetchPositions()
  }, [])

  const refresh = () => {
    fetchHoldings()
    fetchPositions()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Portfolio</h2>
        <Button onClick={refresh} disabled={isLoading} variant="outline">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="holdings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings">
          <Card>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
              <CardDescription>Your long-term stock holdings</CardDescription>
            </CardHeader>
            <CardContent>
              {holdings ? (
                holdings.Success && holdings.Success.length > 0 ? (
                  <div className="space-y-4">
                    {holdings.Success.map((holding: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-4 border rounded-lg">
                        <div>
                          <h3 className="font-semibold">{holding.stock_code}</h3>
                          <p className="text-sm text-gray-600">Qty: {holding.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{holding.current_value}</p>
                          <p className={`text-sm ${holding.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {holding.pnl >= 0 ? "+" : ""}₹{holding.pnl}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No holdings found</p>
                )
              ) : (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions">
          <Card>
            <CardHeader>
              <CardTitle>Positions</CardTitle>
              <CardDescription>Your current trading positions</CardDescription>
            </CardHeader>
            <CardContent>
              {positions ? (
                positions.Success && positions.Success.length > 0 ? (
                  <div className="space-y-4">
                    {positions.Success.map((position: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-4 border rounded-lg">
                        <div>
                          <h3 className="font-semibold">{position.stock_code}</h3>
                          <p className="text-sm text-gray-600">
                            {position.action} | Qty: {position.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{position.current_value}</p>
                          <p className={`text-sm ${position.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {position.pnl >= 0 ? (
                              <TrendingUp className="inline h-4 w-4 mr-1" />
                            ) : (
                              <TrendingDown className="inline h-4 w-4 mr-1" />
                            )}
                            {position.pnl >= 0 ? "+" : ""}₹{position.pnl}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No positions found</p>
                )
              ) : (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
