import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { appName } = await req.json();
    
    if (!appName) {
      return new Response(
        JSON.stringify({ error: "App name is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching details for:', appName);

    // Try to find the website URL
    let websiteUrl = '';
    let logoUrl = '';
    let description = '';

    // Common patterns for fintech apps in India
    const searchQuery = `${appName} fintech app india official website`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

    // For demo purposes, we'll use a simple heuristic approach
    // In production, you might want to use a proper API or web scraping service
    const commonDomains: Record<string, any> = {
      'branch': {
        website: 'https://branch.co',
        logo: 'https://branch.co/favicon.ico',
        description: 'Branch International - Financial services app'
      },
      'moneyview': {
        website: 'https://www.moneyview.in',
        logo: 'https://www.moneyview.in/favicon.ico',
        description: 'MoneyView - Personal loan and financial services'
      },
      'navi': {
        website: 'https://www.navi.com',
        logo: 'https://www.navi.com/favicon.ico',
        description: 'Navi - Digital financial services'
      },
      'creditmantri': {
        website: 'https://www.creditmantri.com',
        logo: 'https://www.creditmantri.com/favicon.ico',
        description: 'Credit Mantri - Credit score and loan services'
      },
      'fairmoney': {
        website: 'https://fairmoney.in',
        logo: 'https://fairmoney.in/favicon.ico',
        description: 'FairMoney - Personal loan app'
      },
      'cashe': {
        website: 'https://www.cashe.co.in',
        logo: 'https://www.cashe.co.in/favicon.ico',
        description: 'CASHe - Instant personal loan app'
      },
      'lazypay': {
        website: 'https://www.lazypay.in',
        logo: 'https://www.lazypay.in/favicon.ico',
        description: 'LazyPay - Pay later service'
      },
      'kissht': {
        website: 'https://www.kissht.com',
        logo: 'https://www.kissht.com/favicon.ico',
        description: 'Kissht - Buy now pay later'
      }
    };

    // Normalize app name for lookup
    const normalizedName = appName.toLowerCase().replace(/\s+/g, '');

    // Check if we have predefined data
    if (commonDomains[normalizedName]) {
      const data = commonDomains[normalizedName];
      websiteUrl = data.website;
      logoUrl = data.logo;
      description = data.description;
    } else {
      // Try to construct a likely website URL
      websiteUrl = `https://www.${normalizedName}.com`;
      
      // Try to fetch the website and extract details
      try {
        const response = await fetch(websiteUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (response.ok) {
          const html = await response.text();
          
          // Extract logo from various meta tags
          const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
          const appleTouchIconMatch = html.match(/<link\s+rel="apple-touch-icon"\s+href="([^"]+)"/i);
          const faviconMatch = html.match(/<link\s+rel="icon"\s+href="([^"]+)"/i);
          
          if (ogImageMatch) {
            logoUrl = ogImageMatch[1];
          } else if (appleTouchIconMatch) {
            logoUrl = appleTouchIconMatch[1];
          } else if (faviconMatch) {
            logoUrl = faviconMatch[1];
          } else {
            logoUrl = `${websiteUrl}/favicon.ico`;
          }

          // Make logo URL absolute if it's relative
          if (logoUrl && !logoUrl.startsWith('http')) {
            logoUrl = new URL(logoUrl, websiteUrl).toString();
          }

          // Extract description
          const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) ||
                           html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
          if (descMatch) {
            description = descMatch[1];
          }
        }
      } catch (fetchError) {
        console.error('Error fetching website:', fetchError);
        // Keep the constructed URL but mark logo as unavailable
        logoUrl = '';
      }
    }

    return new Response(
      JSON.stringify({
        website: websiteUrl,
        logo_url: logoUrl,
        description: description,
        name: appName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-lender-details:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
