'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function SeedDemoPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const seedDemoUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/seed-demo-users', { method: 'POST' });
      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <Card className="max-w-2xl w-full p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Seed Demo Users
          </h1>
          <p className="text-muted-foreground">
            Click the button below to create demo accounts and sample data.
          </p>
        </div>

        <Button 
          onClick={seedDemoUsers} 
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? 'Creating Demo Users...' : 'Create Demo Users & Data'}
        </Button>

        {result && (
          <div className="space-y-4">
            {result.error ? (
              <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                <strong>Error:</strong> {result.error}
              </div>
            ) : (
              <>
                <div className="bg-green-500/10 text-green-700 p-4 rounded-lg">
                  <strong>✅ Demo users created successfully!</strong>
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-semibold">Login Credentials:</h3>
                  {result.credentials?.map((cred: any) => (
                    <div key={cred.email} className="bg-muted p-3 rounded-lg font-mono text-sm">
                      <div><strong>Email:</strong> {cred.email}</div>
                      <div><strong>Password:</strong> {cred.password}</div>
                      <div><strong>Role:</strong> {cred.role}</div>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <a href="/sign-in">
                    <Button variant="outline" className="w-full">
                      Go to Sign In →
                    </Button>
                  </a>
                </div>
              </>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">View Raw Response</summary>
              <pre className="mt-2 bg-muted p-4 rounded-lg overflow-auto text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </Card>
    </div>
  );
}
