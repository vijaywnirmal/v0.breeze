"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus, Minus } from "lucide-react"

interface FundsManagerProps {
  credentials: {
    api_key: string
    api_secret: string
    session_token: string
  }
  onFundsUpdate: (funds: any) => void
  currentFunds: any
}

export function FundsManager({ credentials, onFundsUpdate, currentFunds }: FundsManagerProps) {
  const [amount, setAmount] = useState("")
  const [segment, setSegment] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")

  const handleFundsAction = async (action: "allocate" | "unallocate") => {
    if (!amount || !segment) {
      setMessage("Please enter amount and select segment")
      setMessageType("error")
      return
    }

    setIsLoading(true)
    setMessage("")

    try {
      const endpoint = action === "allocate" ? "/api/allocate_funds" : "/api/unallocate_funds"
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...credentials,
          segment,
          amount: Number.parseFloat(amount),
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage(data.message)
        setMessageType("success")
        setAmount("")
        setSegment("")

        // Refresh funds
        const fundsResponse = await fetch("http://localhost:8000/api/funds", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(credentials),
        })

        const fundsData = await fundsResponse.json()
        if (fundsData.success) {
          onFundsUpdate(fundsData.funds)
        }
      } else {
        setMessage(data.message)
        setMessageType("error")
      }
    } catch (error) {
      setMessage("Network error occurred")
      setMessageType("error")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Fund Allocation</CardTitle>
          <CardDescription>Allocate or unallocate funds between different segments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="segment">Segment</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger>
                <SelectValue placeholder="Select segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="fno">F&O</SelectItem>
                <SelectItem value="commodity">Commodity</SelectItem>
                <SelectItem value="currency">Currency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {message && (
            <Alert variant={messageType === "error" ? "destructive" : "default"}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <div className="flex space-x-2">
            <Button onClick={() => handleFundsAction("allocate")} disabled={isLoading} className="flex-1">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Allocate
            </Button>
            <Button
              onClick={() => handleFundsAction("unallocate")}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Minus className="mr-2 h-4 w-4" />}
              Unallocate
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Allocation</CardTitle>
          <CardDescription>Your current fund allocation across segments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Equity</span>
              <span className="text-lg font-semibold">₹{currentFunds?.allocated_equity || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">F&O</span>
              <span className="text-lg font-semibold">₹{currentFunds?.allocated_fno || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Commodity</span>
              <span className="text-lg font-semibold">₹{currentFunds?.allocated_commodity || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">Currency</span>
              <span className="text-lg font-semibold">₹{currentFunds?.allocated_currency || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="font-medium text-blue-800">Unallocated</span>
              <span className="text-lg font-semibold text-blue-800">₹{currentFunds?.unallocated_balance || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
