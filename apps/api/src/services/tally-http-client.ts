/**
 * Tally HTTP Client
 * 
 * Handles HTTP communication with on-premise Tally ERP via XML/HTTP.
 */

export interface TallyHttpResponse {
  success: boolean;
  message?: string;
  error?: string;
}

const TALLY_MIDDLEWARE_URL = process.env.TALLY_MIDDLEWARE_URL || 'http://localhost:9000/tally';
const TALLY_TIMEOUT_MS = parseInt(process.env.TALLY_TIMEOUT_MS || '30000', 10);

/**
 * Post XML voucher to Tally
 */
export async function postVoucherToTally(voucherXML: string): Promise<TallyHttpResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TALLY_TIMEOUT_MS);

    const response = await fetch(TALLY_MIDDLEWARE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
      body: voucherXML,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${responseText}`,
      };
    }

    // Parse Tally response
    const success = !responseText.includes('<LINEERROR>') && !responseText.includes('Error');
    
    return {
      success,
      message: success ? 'Voucher posted successfully' : responseText,
      error: success ? undefined : responseText,
    };

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `Timeout after ${TALLY_TIMEOUT_MS}ms`,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'Unknown error occurred',
    };
  }
}

/**
 * Check Tally connection health
 */
export async function checkTallyConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    // Send a simple request to check connectivity
    const testXML = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Company Info</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check

    const response = await fetch(TALLY_MIDDLEWARE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
      },
      body: testXML,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { connected: true };
    } else {
      return { 
        connected: false, 
        error: `HTTP ${response.status}` 
      };
    }

  } catch (error) {
    if (error instanceof Error) {
      return { 
        connected: false, 
        error: error.message 
      };
    }
    return { 
      connected: false, 
      error: 'Unknown error' 
    };
  }
}
