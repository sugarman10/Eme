import{u as A,r as c,a as x,j as e,i as u,R as _,k as C,Z as S,l as F,F as P}from"./index-BGuOUKj3.js";import{C as m}from"./Card-BNQQ-YZE.js";import{B as h}from"./Button-CyOOs34d.js";import{C as B}from"./circle-check-big-3Pia_KNp.js";import{P as E}from"./printer-DdgvBhB8.js";import{T as I}from"./trash-2-BwU9n_pe.js";import{E as R}from"./eye-BJKkGaqB.js";const s=d=>new Intl.NumberFormat("ar-LY",{style:"currency",currency:"LYD"}).format(d||0);function K(){const{push:d}=A(),[p,b]=c.useState([]),[i,f]=c.useState(null),[r,j]=c.useState(null),[D,y]=c.useState(!0),[l,k]=c.useState(null),[v,N]=c.useState(!1);c.useEffect(()=>{g(),w()},[]);const g=async()=>{y(!0);try{const{data:t}=await x.get("/daily-closures");b(t)}catch(t){console.error("Failed to load closures:",t),d("error","فشل تحميل تقارير الإغلاق")}finally{y(!1)}},w=async()=>{try{const{data:t}=await x.get("/daily-closures/summary-today");k(t)}catch(t){console.error("Failed to load today summary:",t)}},$=async t=>{f(t);try{const a=new Date(t.date).toISOString().split("T")[0],{data:n}=await x.get(`/daily-closures/${a}`);j(n)}catch(a){console.error("Failed to load closure details:",a)}},z=async()=>{if(window.confirm("هل تريد إغلاق حساب اليوم؟")){N(!0);try{await x.post("/daily-closures",{date:new Date().toISOString().split("T")[0]}),d("success","تم إغلاق حساب اليوم بنجاح"),g(),w()}catch(t){d("error",t?.response?.data?.message||"فشل إغلاق حساب اليوم")}finally{N(!1)}}},L=async t=>{if(window.confirm("هل أنت متأكد من حذف هذا التقرير؟"))try{await x.delete(`/daily-closures/${t}`),d("success","تم حذف التقرير بنجاح"),b(a=>a.filter(n=>n._id!==t)),f(null),j(null)}catch{d("error","فشل حذف التقرير")}},T=t=>{const a=r||t,n=window.open("","_blank");n.document.write(`
            <html dir="rtl">
            <head>
                <title>تقرير إغلاق ${new Date(t.date).toLocaleDateString("ar-LY")}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { text-align: center; color: #333; }
                    .summary { display: flex; justify-content: space-around; margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 8px; }
                    .stat { text-align: center; }
                    .stat-value { font-size: 24px; font-weight: bold; color: #4f46e5; }
                    .stat-label { color: #666; font-size: 12px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 12px; border: 1px solid #ddd; text-align: right; }
                    th { background: #f0f0f0; }
                    .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
                    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
                    .auto { background: #fef3c7; color: #92400e; }
                    .manual { background: #dbeafe; color: #1e40af; }
                </style>
            </head>
            <body>
                <h1>🔒 تقرير إغلاق يوم ${new Date(t.date).toLocaleDateString("ar-LY",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</h1>
                <p style="text-align: center">
                    <span class="badge ${t.isAutomatic?"auto":"manual"}">${t.isAutomatic?"⚡ إغلاق تلقائي":"👤 إغلاق يدوي"}</span>
                </p>
                <div class="summary">
                    <div class="stat">
                        <div class="stat-value">${t.summary?.invoiceCount||0}</div>
                        <div class="stat-label">عدد الفواتير</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${s(t.summary?.totalSales)}</div>
                        <div class="stat-label">إجمالي المبيعات</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" style="color: green">${s(t.summary?.totalPaid)}</div>
                        <div class="stat-label">المحصّل</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" style="color: red">${s(t.summary?.totalDue)}</div>
                        <div class="stat-label">الآجل</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>رقم الفاتورة</th>
                            <th>العميل</th>
                            <th>الإجمالي</th>
                            <th>المدفوع</th>
                            <th>الوقت</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(a.invoiceDetails||[]).map((o,Y)=>`
                            <tr>
                                <td>${Y+1}</td>
                                <td>#${o.number}</td>
                                <td>${o.customer}</td>
                                <td>${s(o.total)}</td>
                                <td>${s(o.paid)}</td>
                                <td>${new Date(o.createdAt).toLocaleTimeString("ar-LY",{hour:"2-digit",minute:"2-digit"})}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
                <div class="footer">
                    تم الإغلاق بتاريخ ${new Date(t.closedAt).toLocaleString("ar-LY")}
                    ${t.closedBy?.name?` بواسطة ${t.closedBy.name}`:""}
                </div>
            </body>
            </html>
        `),n.document.close(),n.print()};return e.jsxs("div",{className:"min-h-screen bg-slate-50/50 p-6 flex flex-col gap-6 animate-in fade-in",children:[e.jsxs("div",{className:"flex flex-col md:flex-row justify-between items-start md:items-center gap-4",children:[e.jsxs("div",{children:[e.jsxs("h1",{className:"text-2xl font-bold text-slate-900 flex items-center gap-2",children:[e.jsx(u,{className:"text-orange-500",size:28}),"تقارير الإغلاق اليومي"]}),e.jsx("p",{className:"text-sm text-slate-500",children:"سجل إغلاقات الحسابات اليومية"})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsxs(h,{variant:"secondary",onClick:g,className:"gap-2",children:[e.jsx(_,{size:16}),"تحديث"]}),l&&!l.isClosed&&e.jsxs(h,{onClick:z,disabled:v,className:"gap-2 bg-orange-600 hover:bg-orange-700",children:[e.jsx(u,{size:16}),v?"جاري الإغلاق...":`إغلاق اليوم (${l.summary?.invoiceCount||0} فاتورة)`]})]})]}),l&&!l.isClosed&&e.jsx(m,{className:"p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200",children:e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600",children:e.jsx(C,{size:20})}),e.jsxs("div",{children:[e.jsx("h3",{className:"font-bold text-slate-800",children:"ملخص اليوم (لم يُغلق بعد)"}),e.jsxs("p",{className:"text-xs text-slate-500",children:[l.summary?.invoiceCount||0," فاتورة"]})]})]}),e.jsxs("div",{className:"flex gap-6 text-center",children:[e.jsxs("div",{children:[e.jsx("div",{className:"text-lg font-bold text-emerald-600",children:s(l.summary?.totalSales)}),e.jsx("div",{className:"text-[10px] text-slate-500",children:"إجمالي المبيعات"})]}),e.jsxs("div",{children:[e.jsx("div",{className:"text-lg font-bold text-blue-600",children:s(l.summary?.totalPaid)}),e.jsx("div",{className:"text-[10px] text-slate-500",children:"المحصّل"})]}),e.jsxs("div",{children:[e.jsx("div",{className:"text-lg font-bold text-red-600",children:s(l.summary?.totalDue)}),e.jsx("div",{className:"text-[10px] text-slate-500",children:"الآجل"})]})]})]})}),e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-6",children:[e.jsx("div",{className:"lg:col-span-1",children:e.jsxs(m,{className:"p-4 shadow-sm border bg-white",children:[e.jsxs("h3",{className:"font-bold text-slate-800 mb-4 flex items-center gap-2",children:[e.jsx(C,{size:18,className:"text-slate-500"}),"الأيام المغلقة (",p.length,")"]}),D?e.jsx("div",{className:"text-center py-8 text-slate-400",children:"جاري التحميل..."}):p.length===0?e.jsxs("div",{className:"text-center py-8 text-slate-400",children:[e.jsx(u,{size:40,className:"mx-auto mb-2 opacity-30"}),e.jsx("p",{children:"لا توجد تقارير إغلاق"})]}):e.jsx("div",{className:"space-y-2 max-h-[60vh] overflow-y-auto",children:p.map(t=>e.jsxs("div",{onClick:()=>$(t),className:`p-3 rounded-lg border cursor-pointer transition-all ${i?._id===t._id?"bg-orange-50 border-orange-300":"bg-white border-slate-200 hover:border-slate-300"}`,children:[e.jsxs("div",{className:"flex items-center justify-between mb-1",children:[e.jsx("div",{className:"font-bold text-slate-800 text-sm",children:new Date(t.date).toLocaleDateString("ar-LY",{weekday:"short",month:"short",day:"numeric"})}),e.jsx("div",{className:"flex items-center gap-1",children:t.isAutomatic?e.jsxs("span",{className:"text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1",children:[e.jsx(S,{size:10}),"تلقائي"]}):e.jsx(B,{size:16,className:"text-emerald-500"})})]}),e.jsxs("div",{className:"flex items-center justify-between text-xs text-slate-500",children:[e.jsxs("span",{children:[t.summary?.invoiceCount||0," فاتورة"]}),e.jsx("span",{className:"font-mono font-bold text-emerald-600",children:s(t.summary?.totalSales)})]})]},t._id))})]})}),e.jsx("div",{className:"lg:col-span-2",children:i&&r?e.jsxs(m,{className:"shadow-sm border bg-white overflow-hidden",children:[e.jsx("div",{className:"p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b",children:e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsxs("h3",{className:"font-bold text-lg text-slate-900",children:["تقرير يوم ",new Date(i.date).toLocaleDateString("ar-LY",{weekday:"long",year:"numeric",month:"long",day:"numeric"})]}),e.jsxs("p",{className:"text-xs text-slate-500 flex items-center gap-2",children:[e.jsx(F,{size:12}),"تم الإغلاق: ",new Date(i.closedAt).toLocaleString("ar-LY"),i.isAutomatic&&e.jsxs("span",{className:"bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] flex items-center gap-1",children:[e.jsx(S,{size:10}),"إغلاق تلقائي"]})]})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsxs(h,{size:"sm",variant:"secondary",onClick:()=>T(i),className:"gap-1",children:[e.jsx(E,{size:14}),"طباعة"]}),e.jsxs(h,{size:"sm",variant:"destructive",onClick:()=>L(i._id),className:"gap-1",children:[e.jsx(I,{size:14}),"حذف"]})]})]})}),e.jsxs("div",{className:"p-4 bg-slate-50 border-b grid grid-cols-2 md:grid-cols-4 gap-3",children:[e.jsxs("div",{className:"bg-white rounded-lg p-3 border border-slate-200 text-center",children:[e.jsx("div",{className:"text-[10px] text-slate-500 font-bold mb-1",children:"عدد الفواتير"}),e.jsx("div",{className:"text-2xl font-black text-slate-800",children:r.summary?.invoiceCount||0})]}),e.jsxs("div",{className:"bg-white rounded-lg p-3 border border-emerald-200 text-center",children:[e.jsx("div",{className:"text-[10px] text-emerald-600 font-bold mb-1",children:"إجمالي المبيعات"}),e.jsx("div",{className:"text-lg font-black text-emerald-600 font-mono",children:s(r.summary?.totalSales)})]}),e.jsxs("div",{className:"bg-white rounded-lg p-3 border border-blue-200 text-center",children:[e.jsx("div",{className:"text-[10px] text-blue-600 font-bold mb-1",children:"المحصّل"}),e.jsx("div",{className:"text-lg font-black text-blue-600 font-mono",children:s(r.summary?.totalPaid)})]}),e.jsxs("div",{className:"bg-white rounded-lg p-3 border border-red-200 text-center",children:[e.jsx("div",{className:"text-[10px] text-red-600 font-bold mb-1",children:"الآجل"}),e.jsx("div",{className:"text-lg font-black text-red-600 font-mono",children:s(r.summary?.totalDue)})]})]}),e.jsxs("div",{className:"p-4 max-h-[50vh] overflow-y-auto",children:[e.jsxs("h4",{className:"text-sm font-bold text-slate-700 mb-3 flex items-center gap-2",children:[e.jsx(P,{size:16}),"تفاصيل الفواتير (",r.invoiceDetails?.length||0,")"]}),e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{className:"bg-slate-50 text-slate-600 font-bold",children:e.jsxs("tr",{children:[e.jsx("th",{className:"p-2 text-right",children:"#"}),e.jsx("th",{className:"p-2 text-right",children:"رقم الفاتورة"}),e.jsx("th",{className:"p-2 text-right",children:"العميل"}),e.jsx("th",{className:"p-2 text-center",children:"الإجمالي"}),e.jsx("th",{className:"p-2 text-center",children:"المدفوع"}),e.jsx("th",{className:"p-2 text-left",children:"الوقت"})]})}),e.jsx("tbody",{className:"divide-y divide-slate-100",children:(r.invoiceDetails||[]).map((t,a)=>e.jsxs("tr",{className:"hover:bg-slate-50",children:[e.jsx("td",{className:"p-2 text-slate-400 font-mono",children:a+1}),e.jsxs("td",{className:"p-2 font-bold text-slate-800",children:["#",t.number]}),e.jsx("td",{className:"p-2 text-slate-700",children:t.customer}),e.jsx("td",{className:"p-2 text-center font-mono font-bold",children:s(t.total)}),e.jsx("td",{className:"p-2 text-center font-mono text-emerald-600",children:s(t.paid)}),e.jsx("td",{className:"p-2 text-left text-slate-500 text-xs",children:new Date(t.createdAt).toLocaleTimeString("ar-LY",{hour:"2-digit",minute:"2-digit"})})]},t._id||a))})]})]})]}):e.jsx(m,{className:"shadow-sm border bg-white flex items-center justify-center h-64",children:e.jsxs("div",{className:"text-center text-slate-400",children:[e.jsx(R,{size:40,className:"mx-auto mb-2 opacity-30"}),e.jsx("p",{children:"اختر يوم لعرض التفاصيل"})]})})})]})]})}export{K as default};
