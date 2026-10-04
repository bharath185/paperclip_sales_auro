async function searchDDG(query) {
  try {
    const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const html = await res.text();
    console.log('DDG Status:', res.status, 'HTML length:', html.length);
    const results = [];
    const linkRegex = /<a[^>]*class="result__snippet"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const titleRegex = /<a[^>]*class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = titleRegex.exec(html)) !== null && results.length < 10) {
      results.push({ href: match[1].trim(), text: match[2].replace(/<[^>]+>/g, '').trim() });
    }
    console.log('Extracted results count:', results.length);
    console.log('Samples:', results.slice(0, 5));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

searchDDG('manufacturing companies in Bengaluru Peenya');
