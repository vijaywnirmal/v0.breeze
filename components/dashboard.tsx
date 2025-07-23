"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogOut, User, Wallet, TrendingUp, BarChart3 } from "lucide-react"
import { FundsManager } from "@/components/funds-manager"
import { MarketData } from "@/components/market-data"
import { OrderForm } from "@/components/order-form"
import { Portfolio } from "@/components/portfolio"

interface DashboardProps {
  userData: {
    user_name: string
    userid: string
    funds: any
    credentials: {
      api_key: string
      api_secret: string
      session_token: string
    }
  }
  onLogout: () => void
}

export function Dashboard({ userData, onLogout }: DashboardProps) {
  const [funds, setFunds] = useState(userData.funds)
  const [refreshing, setRefreshing] = useState(false)
  const [lastFundsFetch, setLastFundsFetch] = useState<number>(Date.now())

  // Cache funds for 1 minute
  const refreshFunds = async () => {
    const now = Date.now()
    if (now - lastFundsFetch < 60000) {
      // Less than 1 minute since last fetch, do not refetch
      return
    }
    setRefreshing(true)
    try {
      const response = await fetch("http://localhost:8000/api/funds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData.credentials),
      })

      const data = await response.json()
      if (data.success) {
        setFunds(data.funds)
        setLastFundsFetch(now)
      }
    } catch (error) {
      console.error("Error refreshing funds:", error)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    // Try to refresh funds every 10 seconds, but will only fetch if 1 minute has passed
    const interval = setInterval(refreshFunds, 10000)
    return () => clearInterval(interval)
  }, [])

  // When funds are updated from FundsManager, update cache and last fetch time
  const handleFundsUpdate = (newFunds: any) => {
    setFunds(newFunds)
    setLastFundsFetch(Date.now())
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Breeze Trading</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <User className="h-4 w-4 mr-1" />
                {userData.user_name} ({userData.userid})
              </div>
              <Button variant="outline" size="sm" onClick={onLogout}>
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Funds Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{funds?.total_bank_balance || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unallocated</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{funds?.unallocated_balance || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equity Allocated</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{funds?.allocated_equity || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">F&O Allocated</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{funds?.allocated_fno || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="funds" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="funds">Funds</TabsTrigger>
            <TabsTrigger value="market">Market</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          </TabsList>

          <TabsContent value="funds">
            <FundsManager credentials={userData.credentials} onFundsUpdate={handleFundsUpdate} currentFunds={funds} />
          </TabsContent>

          <TabsContent value="market">
            <MarketData credentials={userData.credentials} />
          </TabsContent>

          <TabsContent value="orders">
            <OrderForm credentials={userData.credentials} />
          </TabsContent>

          <TabsContent value="portfolio">
            <Portfolio credentials={userData.credentials} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
