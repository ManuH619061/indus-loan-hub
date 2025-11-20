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

    // Comprehensive list of loan apps from Play Store and App Store
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
      },
      'paytm': {
        website: 'https://paytm.com',
        logo: 'https://paytm.com/favicon.ico',
        description: 'Paytm - Digital payments and financial services'
      },
      'phonepe': {
        website: 'https://www.phonepe.com',
        logo: 'https://www.phonepe.com/favicon.ico',
        description: 'PhonePe - Digital payments and loans'
      },
      'googlepay': {
        website: 'https://pay.google.com',
        logo: 'https://pay.google.com/favicon.ico',
        description: 'Google Pay - Digital wallet and payments'
      },
      'amazonpay': {
        website: 'https://www.amazon.in/amazonpay',
        logo: 'https://www.amazon.in/favicon.ico',
        description: 'Amazon Pay - Digital payments service'
      },
      'cred': {
        website: 'https://cred.club',
        logo: 'https://cred.club/favicon.ico',
        description: 'CRED - Credit card bill payments and rewards'
      },
      'mobikwik': {
        website: 'https://www.mobikwik.com',
        logo: 'https://www.mobikwik.com/favicon.ico',
        description: 'MobiKwik - Digital wallet and financial services'
      },
      'freecharge': {
        website: 'https://www.freecharge.in',
        logo: 'https://www.freecharge.in/favicon.ico',
        description: 'Freecharge - Digital payments and recharges'
      },
      'bajajfinserv': {
        website: 'https://www.bajajfinserv.in',
        logo: 'https://www.bajajfinserv.in/favicon.ico',
        description: 'Bajaj Finserv - Personal loans and EMI cards'
      },
      'tatadigital': {
        website: 'https://www.tata.digital',
        logo: 'https://www.tata.digital/favicon.ico',
        description: 'Tata Digital - Financial services'
      },
      'dhani': {
        website: 'https://dhani.com',
        logo: 'https://dhani.com/favicon.ico',
        description: 'Dhani - Instant personal loans'
      },
      'earlysalary': {
        website: 'https://www.earlysalary.com',
        logo: 'https://www.earlysalary.com/favicon.ico',
        description: 'EarlySalary - Instant salary advance'
      },
      'kreditt': {
        website: 'https://www.kreditt.in',
        logo: 'https://www.kreditt.in/favicon.ico',
        description: 'KreditBee - Personal loan app'
      },
      'kreditbee': {
        website: 'https://www.kreditbee.in',
        logo: 'https://www.kreditbee.in/favicon.ico',
        description: 'KreditBee - Personal loan app'
      },
      'moneytap': {
        website: 'https://www.moneytap.com',
        logo: 'https://www.moneytap.com/favicon.ico',
        description: 'MoneyTap - Credit line app'
      },
      'stashfin': {
        website: 'https://www.stashfin.com',
        logo: 'https://www.stashfin.com/favicon.ico',
        description: 'StashFin - Personal loan and credit line'
      },
      'paysense': {
        website: 'https://www.paysense.com',
        logo: 'https://www.paysense.com/favicon.ico',
        description: 'PaySense - Instant personal loans'
      },
      'incred': {
        website: 'https://www.incred.com',
        logo: 'https://www.incred.com/favicon.ico',
        description: 'InCred - Personal and education loans'
      },
      'lendingkart': {
        website: 'https://www.lendingkart.com',
        logo: 'https://www.lendingkart.com/favicon.ico',
        description: 'Lendingkart - Business loans'
      },
      'prefr': {
        website: 'https://www.prefr.com',
        logo: 'https://www.prefr.com/favicon.ico',
        description: 'Prefr - Consumer durable financing'
      },
      'zestmoney': {
        website: 'https://www.zestmoney.in',
        logo: 'https://www.zestmoney.in/favicon.ico',
        description: 'ZestMoney - Buy now pay later'
      },
      'simpl': {
        website: 'https://getsimpl.com',
        logo: 'https://getsimpl.com/favicon.ico',
        description: 'Simpl - Buy now pay later'
      },
      'flexmoney': {
        website: 'https://www.flexmoney.in',
        logo: 'https://www.flexmoney.in/favicon.ico',
        description: 'FlexMoney - Cardless EMI solutions'
      },
      'instacred': {
        website: 'https://www.instacred.me',
        logo: 'https://www.instacred.me/favicon.ico',
        description: 'InstaCred - Instant loans'
      },
      'rupeecircle': {
        website: 'https://www.rupeecircle.com',
        logo: 'https://www.rupeecircle.com/favicon.ico',
        description: 'RupeeCircle - P2P lending platform'
      },
      'lendbox': {
        website: 'https://www.lendbox.in',
        logo: 'https://www.lendbox.in/favicon.ico',
        description: 'Lendbox - P2P lending'
      },
      'indifi': {
        website: 'https://www.indifi.com',
        logo: 'https://www.indifi.com/favicon.ico',
        description: 'Indifi - Business loans'
      },
      'capital18': {
        website: 'https://www.capital18.com',
        logo: 'https://www.capital18.com/favicon.ico',
        description: 'Capital18 - Business loans'
      },
      'niyo': {
        website: 'https://www.goniyo.com',
        logo: 'https://www.goniyo.com/favicon.ico',
        description: 'Niyo - Digital banking solutions'
      },
      'slice': {
        website: 'https://www.sliceit.com',
        logo: 'https://www.sliceit.com/favicon.ico',
        description: 'Slice - Credit card and payments'
      },
      'uni': {
        website: 'https://www.uni.club',
        logo: 'https://www.uni.club/favicon.ico',
        description: 'Uni - Pay 1/3rd cards'
      },
      'onecard': {
        website: 'https://www.getonecard.app',
        logo: 'https://www.getonecard.app/favicon.ico',
        description: 'OneCard - Metal credit card'
      },
      'jupiter': {
        website: 'https://jupiter.money',
        logo: 'https://jupiter.money/favicon.ico',
        description: 'Jupiter - Digital banking'
      },
      'fi': {
        website: 'https://fi.money',
        logo: 'https://fi.money/favicon.ico',
        description: 'Fi Money - Smart money app'
      },
      'epifi': {
        website: 'https://www.epifi.com',
        logo: 'https://www.epifi.com/favicon.ico',
        description: 'Epifi - Credit cards and loans'
      },
      'kreditzy': {
        website: 'https://www.kreditzy.com',
        logo: 'https://www.kreditzy.com/favicon.ico',
        description: 'Kreditzy - Personal loans'
      },
      'loantap': {
        website: 'https://www.loantap.in',
        logo: 'https://www.loantap.in/favicon.ico',
        description: 'LoanTap - Personal loans and credit line'
      },
      'fullertonindia': {
        website: 'https://www.fullertonindia.com',
        logo: 'https://www.fullertonindia.com/favicon.ico',
        description: 'Fullerton India - Personal and business loans'
      },
      'tataCapital': {
        website: 'https://www.tatacapital.com',
        logo: 'https://www.tatacapital.com/favicon.ico',
        description: 'Tata Capital - Personal and business loans'
      },
      'hdb': {
        website: 'https://www.hdbfs.com',
        logo: 'https://www.hdbfs.com/favicon.ico',
        description: 'HDB Financial Services - Loans and financial services'
      },
      'idfc': {
        website: 'https://www.idfcfirstbank.com',
        logo: 'https://www.idfcfirstbank.com/favicon.ico',
        description: 'IDFC First Bank - Personal loans'
      },
      'hdfc': {
        website: 'https://www.hdfcbank.com',
        logo: 'https://www.hdfcbank.com/favicon.ico',
        description: 'HDFC Bank - Personal and home loans'
      },
      'icici': {
        website: 'https://www.icicibank.com',
        logo: 'https://www.icicibank.com/favicon.ico',
        description: 'ICICI Bank - Personal and home loans'
      },
      'sbi': {
        website: 'https://www.sbi.co.in',
        logo: 'https://www.sbi.co.in/favicon.ico',
        description: 'State Bank of India - All types of loans'
      },
      'axis': {
        website: 'https://www.axisbank.com',
        logo: 'https://www.axisbank.com/favicon.ico',
        description: 'Axis Bank - Personal and home loans'
      },
      'kotak': {
        website: 'https://www.kotak.com',
        logo: 'https://www.kotak.com/favicon.ico',
        description: 'Kotak Mahindra Bank - Personal loans'
      },
      'indusind': {
        website: 'https://www.indusind.com',
        logo: 'https://www.indusind.com/favicon.ico',
        description: 'IndusInd Bank - Personal loans'
      },
      'yesbank': {
        website: 'https://www.yesbank.in',
        logo: 'https://www.yesbank.in/favicon.ico',
        description: 'Yes Bank - Personal loans'
      },
      'rbl': {
        website: 'https://www.rblbank.com',
        logo: 'https://www.rblbank.com/favicon.ico',
        description: 'RBL Bank - Personal loans'
      },
      'standard': {
        website: 'https://www.sc.com/in',
        logo: 'https://www.sc.com/favicon.ico',
        description: 'Standard Chartered - Personal loans'
      },
      'pnb': {
        website: 'https://www.pnbindia.in',
        logo: 'https://www.pnbindia.in/favicon.ico',
        description: 'Punjab National Bank - Personal loans'
      },
      'bob': {
        website: 'https://www.bankofbaroda.in',
        logo: 'https://www.bankofbaroda.in/favicon.ico',
        description: 'Bank of Baroda - Personal loans'
      },
      'unionbank': {
        website: 'https://www.unionbankofindia.co.in',
        logo: 'https://www.unionbankofindia.co.in/favicon.ico',
        description: 'Union Bank of India - Personal loans'
      },
      'canara': {
        website: 'https://www.canarabank.com',
        logo: 'https://www.canarabank.com/favicon.ico',
        description: 'Canara Bank - Personal loans'
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
