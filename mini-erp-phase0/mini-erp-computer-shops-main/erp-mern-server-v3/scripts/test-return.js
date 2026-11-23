(async ()=>{
  const base = 'http://127.0.0.1:4000'
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) { console.error('❌ ADMIN_PASSWORD غير مضبوط: عيّن كلمة المرور في متغير البيئة ADMIN_PASSWORD قبل التشغيل.'); process.exit(1); }
  const admin = { email: adminEmail, password: adminPassword };
  const headersJson = (token) => ({ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` })

  try{
    // login
    console.log('Logging in...')
    let r = await fetch(base + '/api/auth/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(admin) })
    if (!r.ok) throw new Error('Login failed: ' + await r.text())
    const auth = await r.json()
    const token = auth.token
    console.log('Token:', token)

    // warehouses
    console.log('\nFetching warehouses...')
    r = await fetch(base + '/api/inventory/warehouses', { headers: headersJson(token) })
    const warehouses = await r.json()
    const whId = (Array.isArray(warehouses) && warehouses.length>0) ? warehouses[0]._id : null
    console.log('Warehouse id:', whId)

    // invoices
    console.log('\nFetching invoices...')
    r = await fetch(base + '/api/sales/invoice', { headers: headersJson(token) })
    const invoices = await r.json()
    let invId = (Array.isArray(invoices) && invoices.length>0) ? invoices[0]._id : null
    console.log('Found invoice id:', invId)

    // ensure item and invoice exist
    let itemId = null
    if (!invId){
      // find or create item
      console.log('No invoices found — checking items...')
      r = await fetch(base + '/api/inventory/items', { headers: headersJson(token) })
      const items = await r.json()
      if (Array.isArray(items) && items.length>0) itemId = items[0]._id
      else {
        console.log('Creating test item...')
        const newItem = { sku: 'TESTSKU' + Math.floor(Math.random()*10000), name: 'Test Item ' + Math.floor(Math.random()*10000), price: 10, cost: 5 }
        r = await fetch(base + '/api/inventory/items', { method:'POST', headers: headersJson(token), body: JSON.stringify(newItem) })
        if (!r.ok) throw new Error('Create item failed: ' + await r.text())
        const created = await r.json(); itemId = created._id
        console.log('Created item id:', itemId)
      }

      // create invoice
      console.log('Creating test invoice...')
      const invoiceBody = { items:[{ item:itemId, qty:2, price:10 }], channel:'retail', warehouse: whId }
      r = await fetch(base + '/api/sales/invoice', { method:'POST', headers: headersJson(token), body: JSON.stringify(invoiceBody) })
      if (!r.ok) throw new Error('Create invoice failed: ' + await r.text())
      const createdInv = await r.json(); invId = createdInv._id
      console.log('Created invoice id:', invId)
    }

    // get invoice details
    console.log('\nGetting invoice details...')
    r = await fetch(base + '/api/sales/invoice/' + invId, { headers: headersJson(token) })
    if (!r.ok) throw new Error('Get invoice failed: ' + await r.text())
    const inv = await r.json()
    console.log('Invoice:', JSON.stringify(inv, null, 2))

    // pick first item
    itemId = inv.items && inv.items[0] && (inv.items[0].item._id || inv.items[0].item)
    if (!itemId) throw new Error('No item found on invoice')
    console.log('Returning item id:', itemId)

    // post return
    console.log('\nPosting return of qty 1...')
    const returnBody = { items:[{ item: itemId, qty: 1 }], warehouse: whId, note: 'تجربة إرجاع' }
    r = await fetch(base + '/api/sales/invoice/' + invId + '/return', { method:'POST', headers: headersJson(token), body: JSON.stringify(returnBody) })
    const ret = await r.json()
    if (!r.ok){ console.error('Return failed:', JSON.stringify(ret)); process.exit(2) }
    console.log('Return response:', JSON.stringify(ret, null, 2))

    // check stock balance
    if (whId){
      console.log('\nChecking stock balance...')
      const balUrl = base + '/api/inventory/stock/balance?item=' + itemId + '&warehouse=' + whId
      r = await fetch(balUrl, { headers: headersJson(token) })
      const bal = await r.json()
      console.log('Stock balance:', JSON.stringify(bal, null, 2))
    }

    console.log('\nTest finished successfully')
  }catch(err){
    console.error('Error during test:', err)
    process.exit(1)
  }
})();
