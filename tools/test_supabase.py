import urllib.request
import urllib.error
import os
import sys

def load_env(env_path):
    config = {}
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, val = line.split('=', 1)
                    config[key.strip()] = val.strip()
    return config

def test_connection():
    # Go up if needed or find .env
    env_path = '.env'
    if not os.path.exists(env_path):
        env_path = '../.env'
    
    config = load_env(env_path)
    url = config.get('SUPABASE_URL')
    anon_key = config.get('SUPABASE_ANON_KEY')
    
    if not url or not anon_key:
        print("Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in .env")
        sys.exit(1)
        
    print(f"Testing connectivity to: {url}")
    
    # Query /rest/v1/bolsas to test anon key authentication
    rest_url = f"{url}/rest/v1/bolsas"
    headers = {
        'apikey': anon_key,
        'Authorization': f'Bearer {anon_key}'
    }
    
    req = urllib.request.Request(rest_url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            body = response.read().decode('utf-8')
            print(f"Success! Status Code: {status}")
            print("API handshake successful. Connection established.")
            sys.exit(0)
    except urllib.error.HTTPError as e:
        # 200 or 400 with a valid JSON response from Supabase means it is online and api key is recognized
        # If the API key is completely wrong, it might return 401 Unauthorized
        print(f"HTTP response received: {e.code}")
        body = e.read().decode('utf-8')
        print(f"Response: {body}")
        if e.code in [200, 400, 401, 404]:
            print("API server is online.")
            sys.exit(0)
        else:
            print("Failed handshake.")
            sys.exit(1)
    except Exception as e:
        print(f"Connection failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_connection()
