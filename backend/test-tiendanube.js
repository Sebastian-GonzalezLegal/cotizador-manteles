require('dotenv').config();

async function test() {
  try {
    const storeId = process.env.TIENDANUBE_STORE_ID;
    const accessToken = process.env.TIENDANUBE_ACCESS_TOKEN;
    
    console.log("Store:", storeId);
    console.log("Token:", accessToken.substring(0, 5) + "...");
    
    const productData = {
      name: { es: `Mantel de prueba` },
      published: true,
      variants: [
        {
          price: 1500,
          stock: 1
        }
      ]
    };

    const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/products`, {
      method: 'POST',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'AsturiasMarketApp (contacto@asturiasmarket.com)', 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error desde Tiendanube:', errorText);
    } else {
      const data = await response.json();
      console.log("Exito:", data.permalink || (data.urls && data.urls.es));
    }
  } catch(e) {
    console.error(e);
  }
}

test();
