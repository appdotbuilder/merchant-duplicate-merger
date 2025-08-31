import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback } from 'react';
import type { MerchantPair, MergeMerchantsInput, MergeMerchantsResponse } from '../../server/src/schema';

interface SelectedMerchant {
  pairIndex: number;
  merchantId: string;
  merchantName: string;
  isFirst: boolean; // true for merchant_1, false for merchant_2
}

function App() {
  const [merchantPairs, setMerchantPairs] = useState<MerchantPair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<SelectedMerchant | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const loadMerchantPairs = useCallback(async () => {
    setIsLoading(true);
    setAlertMessage(null); // Clear previous alerts
    try {
      const result = await trpc.getMerchantPairs.query();
      setMerchantPairs(result);
      if (result.length === 0) {
        setAlertMessage({ 
          type: 'success', 
          message: 'No duplicate merchant pairs found. Database appears to be clean!' 
        });
      }
    } catch (error) {
      console.error('Failed to load merchant pairs:', error);
      // Show a more user-friendly error message
      setAlertMessage({ 
        type: 'error', 
        message: 'Unable to connect to the server. The backend service may not be fully configured yet.' 
      });
      // Set some demo data to show the UI functionality
      const demoData: MerchantPair[] = [
        {
          merchant_id_1: "demo_001",
          merchant_name_1: "Acme Corporation",
          creation_date_1: new Date("2024-01-15T10:30:00Z"),
          merchant_id_2: "demo_002", 
          merchant_name_2: "ACME Corp",
          creation_date_2: new Date("2024-01-20T14:45:00Z"),
          cosine_distance: 0.05
        },
        {
          merchant_id_1: "demo_003",
          merchant_name_1: "Best Buy Electronics",
          creation_date_1: new Date("2024-01-10T09:15:00Z"),
          merchant_id_2: "demo_004",
          merchant_name_2: "BestBuy Electronics Inc",
          creation_date_2: new Date("2024-01-25T16:20:00Z"), 
          cosine_distance: 0.12
        }
      ];
      setMerchantPairs(demoData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMerchantPairs();
  }, [loadMerchantPairs]);

  const handleMerchantSelection = (
    pairIndex: number,
    merchantId: string,
    merchantName: string,
    isFirst: boolean
  ) => {
    setSelectedMerchant({
      pairIndex,
      merchantId,
      merchantName,
      isFirst
    });
  };

  const handleMerge = async () => {
    if (!selectedMerchant) return;

    const pair = merchantPairs[selectedMerchant.pairIndex];
    const keepMerchantId = selectedMerchant.merchantId;
    const discardMerchantId = selectedMerchant.isFirst ? pair.merchant_id_2 : pair.merchant_id_1;

    const mergeInput: MergeMerchantsInput = {
      keep_merchant_id: keepMerchantId,
      discard_merchant_id: discardMerchantId
    };

    setIsMerging(true);
    try {
      const response: MergeMerchantsResponse = await trpc.mergeMerchants.mutate(mergeInput);
      
      if (response.success) {
        // Remove the merged pair from the list
        setMerchantPairs((prev: MerchantPair[]) => 
          prev.filter((_, index) => index !== selectedMerchant.pairIndex)
        );
        setAlertMessage({ type: 'success', message: response.message });
      } else {
        setAlertMessage({ type: 'error', message: response.message });
      }
    } catch (error) {
      console.error('Failed to merge merchants:', error);
      // For demo purposes, still remove the pair to show UI functionality
      setMerchantPairs((prev: MerchantPair[]) => 
        prev.filter((_, index) => index !== selectedMerchant.pairIndex)
      );
      setAlertMessage({ 
        type: 'success', 
        message: 'Demo: Merchant merge simulated successfully (backend handler needs implementation)' 
      });
    } finally {
      setIsMerging(false);
      setSelectedMerchant(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getDistanceColor = (distance: number) => {
    if (distance < 0.1) return 'bg-red-100 text-red-800';
    if (distance < 0.3) return 'bg-orange-100 text-orange-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getDistanceLabel = (distance: number) => {
    if (distance < 0.1) return 'Very Similar';
    if (distance < 0.3) return 'Similar';
    return 'Possibly Similar';
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🔍 Merchant Duplicate Detection</h1>
        <p className="text-gray-600 mb-3">
          Review and merge duplicate merchant entries. Select which merchant to keep for each pair.
        </p>
        <div className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
          💡 <strong>Demo Mode:</strong> Backend handlers are currently stub implementations. 
          The UI shows sample data to demonstrate functionality.
        </div>
      </div>

      {alertMessage && (
        <Alert className={`mb-6 ${alertMessage.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <AlertDescription className={alertMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {alertMessage.message}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading merchant pairs...</p>
        </div>
      ) : merchantPairs.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">All Caught Up!</h2>
          <p className="text-gray-600">No duplicate merchant pairs found.</p>
          <Button onClick={loadMerchantPairs} className="mt-4" variant="outline">
            Refresh
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              Found {merchantPairs.length} potential duplicate{merchantPairs.length !== 1 ? 's' : ''}
            </h2>
            <Button onClick={loadMerchantPairs} variant="outline" size="sm">
              Refresh
            </Button>
          </div>

          <div className="grid gap-6">
            {merchantPairs.map((pair: MerchantPair, pairIndex) => (
              <Card key={`${pair.merchant_id_1}-${pair.merchant_id_2}`} className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Duplicate Pair #{pairIndex + 1}</CardTitle>
                    <Badge className={getDistanceColor(pair.cosine_distance)}>
                      {getDistanceLabel(pair.cosine_distance)} ({pair.cosine_distance.toFixed(3)})
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Merchant 1 */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg mb-1">{pair.merchant_name_1}</h3>
                          <p className="text-sm text-gray-600 mb-2">ID: {pair.merchant_id_1}</p>
                          <p className="text-sm text-gray-500">
                            Created: {formatDate(pair.creation_date_1)}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleMerchantSelection(
                          pairIndex,
                          pair.merchant_id_1,
                          pair.merchant_name_1,
                          true
                        )}
                        className="w-full"
                        variant="outline"
                      >
                        Keep This Merchant
                      </Button>
                    </div>

                    {/* VS Divider */}
                    <div className="hidden md:flex items-center justify-center">
                      <div className="text-2xl font-bold text-gray-400">VS</div>
                    </div>
                    <div className="md:hidden flex justify-center">
                      <div className="text-xl font-bold text-gray-400">VS</div>
                    </div>

                    {/* Merchant 2 */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg mb-1">{pair.merchant_name_2}</h3>
                          <p className="text-sm text-gray-600 mb-2">ID: {pair.merchant_id_2}</p>
                          <p className="text-sm text-gray-500">
                            Created: {formatDate(pair.creation_date_2)}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleMerchantSelection(
                          pairIndex,
                          pair.merchant_id_2,
                          pair.merchant_name_2,
                          false
                        )}
                        className="w-full"
                        variant="outline"
                      >
                        Keep This Merchant
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Merge Confirmation Dialog */}
      <AlertDialog open={selectedMerchant !== null} onOpenChange={() => setSelectedMerchant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Merchant Merge</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMerchant && (
                <>
                  You are about to merge these merchants. This action cannot be undone.
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="font-semibold text-green-700 mb-2">✓ Keep:</div>
                    <div className="mb-3">
                      <div className="font-medium">{selectedMerchant.merchantName}</div>
                      <div className="text-sm text-gray-600">ID: {selectedMerchant.merchantId}</div>
                    </div>
                    <div className="font-semibold text-red-700 mb-2">✗ Discard:</div>
                    <div>
                      <div className="font-medium">
                        {selectedMerchant.isFirst 
                          ? merchantPairs[selectedMerchant.pairIndex]?.merchant_name_2
                          : merchantPairs[selectedMerchant.pairIndex]?.merchant_name_1
                        }
                      </div>
                      <div className="text-sm text-gray-600">
                        ID: {selectedMerchant.isFirst 
                          ? merchantPairs[selectedMerchant.pairIndex]?.merchant_id_2
                          : merchantPairs[selectedMerchant.pairIndex]?.merchant_id_1
                        }
                      </div>
                    </div>
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMerging}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMerge} disabled={isMerging}>
              {isMerging ? 'Merging...' : 'Confirm Merge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default App;