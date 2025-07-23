"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Wallet } from "lucide-react"

interface PortfolioProps {
  credentials: {
    api_key: string
    api_secret: string
    session_token: string
  }
}

export function Portfolio({ credentials }: PortfolioProps) {
  const [holdings, setHoldings] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [isLoadingHoldings, setIsLoadingHoldings] = useState(false)
  const [isLoadingPositions, setIsLoadingPositions] = useState(false)
  const [error, setError] = useState("")

  const fetchHoldings = async () => {
    setIsLoadingHoldings(true)
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
        setHoldings(data.holdings || [])
      } else {
        setError(data.message || "Failed to fetch holdings")
      }
    } catch (error) {
      setError("Connection error while fetching holdings")
    } finally {
      setIsLoadingHoldings(false)
    }
  }

  const fetchPositions = async () => {
    setIsLoadingPositions(true)
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
        setPositions(data.positions || [])
      } else {
        setError(data.message || "Failed to fetch positions")
      }
    } catch (error) {
      setError("Connection error while fetching positions")
    } finally {
      setIsLoadingPositions(false)
    }
  }

  useEffect(() => {
    fetchHoldings()
    fetchPositions()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount || 0)
  }

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return "text-green-600"
    if (pnl < 0) return "text-red-600"
    return "text-gray-600"
  }

  const getPnLIcon = (pnl: number) => {
    if (pnl > 0) return <TrendingUp className="h-4 w-4" />
    if (pnl < 0) return <TrendingDown className="h-4 w-4" />
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Portfolio</h2>
          <p className="text-gray-600">View your holdings and positions</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={fetchHoldings} disabled={isLoadingHoldings} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingHoldings ? "animate-spin" : ""}`} />
            Refresh Holdings
          </Button>
          <Button onClick={fetchPositions} disabled={isLoadingPositions} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingPositions ? "animate-spin" : ""}`} />
            Refresh Positions
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="holdings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="holdings" className="flex items-center">
            <Wallet className="mr-2 h-4 w-4" />
            Holdings ({holdings.length})
          </TabsTrigger>
          <TabsTrigger value="positions" className="flex items-center">
            <TrendingUp className="mr-2 h-4 w-4" />
            Positions ({positions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="holdings">
          <Card>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
              <CardDescription>Your long-term investment holdings</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHoldings ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading holdings...</span>
                </div>
              ) : holdings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No holdings found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stock</TableHead>
                        <TableHead>Exchange</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Avg Price</TableHead>
                        <TableHead className="text-right">LTP</TableHead>
                        <TableHead className="text-right">P&L</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holdings.map((holding, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {holding.stock_code || holding.scrip_code || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{holding.exchange_code || "N/A"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{holding.quantity || 0}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(holding.average_price || holding.avg_price || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(holding.ltp || holding.current_price || 0)}
                          </TableCell>
                          <TableCell className={`text-right ${getPnLColor(holding.pnl || 0)}`}>
                            <div className="flex items-center justify-end">
                              {getPnLIcon(holding.pnl || 0)}
                              <span className="ml-1">{formatCurrency(holding.pnl || 0)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(holding.market_value || holding.quantity * holding.ltp || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
              {isLoadingPositions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading positions...</span>
                </div>
              ) : positions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No positions found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stock</TableHead>
                        <TableHead>Exchange</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Avg Price</TableHead>
                        <TableHead className="text-right">LTP</TableHead>
                        <TableHead className="text-right">P&L</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positions.map((position, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {position.stock_code || position.scrip_code || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{position.exchange_code || "N/A"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{position.quantity || 0}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(position.average_price || position.avg_price || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(position.ltp || position.current_price || 0)}
                          </TableCell>
                          <TableCell className={`text-right ${getPnLColor(position.pnl || 0)}`}>
                            <div className="flex items-center justify-end">
                              {getPnLIcon(position.pnl || 0)}
                              <span className="ml-1">{formatCurrency(position.pnl || 0)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(position.market_value || position.quantity * position.ltp || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
