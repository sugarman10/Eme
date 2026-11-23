import{r as p,x as j,j as a,a as P}from"./index-BGuOUKj3.js";let X={data:""},ee=e=>{if(typeof window=="object"){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||X},te=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,re=/\/\*[^]*?\*\/|  +/g,H=/\n+/g,v=(e,t)=>{let r="",s="",o="";for(let n in e){let i=e[n];n[0]=="@"?n[1]=="i"?r=n+" "+i+";":s+=n[1]=="f"?v(i,n):n+"{"+v(i,n[1]=="k"?"":t)+"}":typeof i=="object"?s+=v(i,t?t.replace(/([^,])+/g,c=>n.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,d=>/&/.test(d)?d.replace(/&/g,c):c?c+" "+d:d)):n):i!=null&&(n=/^--/.test(n)?n:n.replace(/[A-Z]/g,"-$&").toLowerCase(),o+=v.p?v.p(n,i):n+":"+i+";")}return r+(t&&o?t+"{"+o+"}":o)+s},g={},V=e=>{if(typeof e=="object"){let t="";for(let r in e)t+=r+V(e[r]);return t}return e},ae=(e,t,r,s,o)=>{let n=V(e),i=g[n]||(g[n]=(d=>{let f=0,u=11;for(;f<d.length;)u=101*u+d.charCodeAt(f++)>>>0;return"go"+u})(n));if(!g[i]){let d=n!==e?e:(f=>{let u,h,x=[{}];for(;u=te.exec(f.replace(re,""));)u[4]?x.shift():u[3]?(h=u[3].replace(H," ").trim(),x.unshift(x[0][h]=x[0][h]||{})):x[0][u[1]]=u[2].replace(H," ").trim();return x[0]})(e);g[i]=v(o?{["@keyframes "+i]:d}:d,r?"":"."+i)}let c=r&&g.g?g.g:null;return r&&(g.g=g[i]),((d,f,u,h)=>{h?f.data=f.data.replace(h,d):f.data.indexOf(d)===-1&&(f.data=u?d+f.data:f.data+d)})(g[i],t,s,c),i},se=(e,t,r)=>e.reduce((s,o,n)=>{let i=t[n];if(i&&i.call){let c=i(r),d=c&&c.props&&c.props.className||/^go/.test(c)&&c;i=d?"."+d:c&&typeof c=="object"?c.props?"":v(c,""):c===!1?"":c}return s+o+(i??"")},"");function E(e){let t=this||{},r=e.call?e(t.p):e;return ae(r.unshift?r.raw?se(r,[].slice.call(arguments,1),t.p):r.reduce((s,o)=>Object.assign(s,o&&o.call?o(t.p):o),{}):r,ee(t.target),t.g,t.o,t.k)}let T,$,L;E.bind({g:1});let b=E.bind({k:1});function ne(e,t,r,s){v.p=t,T=e,$=r,L=s}function y(e,t){let r=this||{};return function(){let s=arguments;function o(n,i){let c=Object.assign({},n),d=c.className||o.className;r.p=Object.assign({theme:$&&$()},c),r.o=/ *go\d+/.test(d),c.className=E.apply(r,s)+(d?" "+d:"");let f=e;return e[0]&&(f=c.as||e,delete c.as),L&&f[0]&&L(c),T(f,c)}return o}}var ie=e=>typeof e=="function",_=(e,t)=>ie(e)?e(t):e,oe=(()=>{let e=0;return()=>(++e).toString()})(),le=(()=>{let e;return()=>{if(e===void 0&&typeof window<"u"){let t=matchMedia("(prefers-reduced-motion: reduce)");e=!t||t.matches}return e}})(),ce=20,q="default",W=(e,t)=>{let{toastLimit:r}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,r)};case 1:return{...e,toasts:e.toasts.map(i=>i.id===t.toast.id?{...i,...t.toast}:i)};case 2:let{toast:s}=t;return W(e,{type:e.toasts.find(i=>i.id===s.id)?1:0,toast:s});case 3:let{toastId:o}=t;return{...e,toasts:e.toasts.map(i=>i.id===o||o===void 0?{...i,dismissed:!0,visible:!1}:i)};case 4:return t.toastId===void 0?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(i=>i.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let n=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(i=>({...i,pauseDuration:i.pauseDuration+n}))}}},de=[],me={toasts:[],pausedAt:void 0,settings:{toastLimit:ce}},w={},Y=(e,t=q)=>{w[t]=W(w[t]||me,e),de.forEach(([r,s])=>{r===t&&s(w[t])})},Z=e=>Object.keys(w).forEach(t=>Y(e,t)),ue=e=>Object.keys(w).find(t=>w[t].toasts.some(r=>r.id===e)),M=(e=q)=>t=>{Y(t,e)},pe=(e,t="blank",r)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...r,id:r?.id||oe()}),N=e=>(t,r)=>{let s=pe(t,e,r);return M(s.toasterId||ue(s.id))({type:2,toast:s}),s.id},m=(e,t)=>N("blank")(e,t);m.error=N("error");m.success=N("success");m.loading=N("loading");m.custom=N("custom");m.dismiss=(e,t)=>{let r={type:3,toastId:e};t?M(t)(r):Z(r)};m.dismissAll=e=>m.dismiss(void 0,e);m.remove=(e,t)=>{let r={type:4,toastId:e};t?M(t)(r):Z(r)};m.removeAll=e=>m.remove(void 0,e);m.promise=(e,t,r)=>{let s=m.loading(t.loading,{...r,...r?.loading});return typeof e=="function"&&(e=e()),e.then(o=>{let n=t.success?_(t.success,o):void 0;return n?m.success(n,{id:s,...r,...r?.success}):m.dismiss(s),o}).catch(o=>{let n=t.error?_(t.error,o):void 0;n?m.error(n,{id:s,...r,...r?.error}):m.dismiss(s)}),e};var fe=b`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,he=b`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,xe=b`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,ge=y("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${fe} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${he} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${xe} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,be=b`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,ve=y("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${be} 1s linear infinite;
`,ye=b`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,je=b`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,we=y("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${ye} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${je} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,Ne=y("div")`
  position: absolute;
`,Oe=y("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,Ce=b`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,Pe=y("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${Ce} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,ze=({toast:e})=>{let{icon:t,type:r,iconTheme:s}=e;return t!==void 0?typeof t=="string"?p.createElement(Pe,null,t):t:r==="blank"?null:p.createElement(Oe,null,p.createElement(ve,{...s}),r!=="loading"&&p.createElement(Ne,null,r==="error"?p.createElement(ge,{...s}):p.createElement(we,{...s})))},Se=e=>`
0% {transform: translate3d(0,${e*-200}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,Ee=e=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${e*-150}%,-1px) scale(.6); opacity:0;}
`,De="0%{opacity:0;} 100%{opacity:1;}",ke="0%{opacity:1;} 100%{opacity:0;}",$e=y("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,Le=y("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,_e=(e,t)=>{let r=e.includes("top")?1:-1,[s,o]=le()?[De,ke]:[Se(r),Ee(r)];return{animation:t?`${b(s)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${b(o)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}};p.memo(({toast:e,position:t,style:r,children:s})=>{let o=e.height?_e(e.position||t||"top-center",e.visible):{opacity:0},n=p.createElement(ze,{toast:e}),i=p.createElement(Le,{...e.ariaProps},_(e.message,e));return p.createElement($e,{className:e.className,style:{...o,...r,...e.style}},typeof s=="function"?s({icon:n,message:i}):p.createElement(p.Fragment,null,n,i))});ne(p.createElement);E`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`;var G={color:void 0,size:void 0,className:void 0,style:void 0,attr:void 0},F=j.createContext&&j.createContext(G),Me=["attr","size","title"];function Ae(e,t){if(e==null)return{};var r=He(e,t),s,o;if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);for(o=0;o<n.length;o++)s=n[o],!(t.indexOf(s)>=0)&&Object.prototype.propertyIsEnumerable.call(e,s)&&(r[s]=e[s])}return r}function He(e,t){if(e==null)return{};var r={};for(var s in e)if(Object.prototype.hasOwnProperty.call(e,s)){if(t.indexOf(s)>=0)continue;r[s]=e[s]}return r}function z(){return z=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var r=arguments[t];for(var s in r)Object.prototype.hasOwnProperty.call(r,s)&&(e[s]=r[s])}return e},z.apply(this,arguments)}function I(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var s=Object.getOwnPropertySymbols(e);t&&(s=s.filter(function(o){return Object.getOwnPropertyDescriptor(e,o).enumerable})),r.push.apply(r,s)}return r}function S(e){for(var t=1;t<arguments.length;t++){var r=arguments[t]!=null?arguments[t]:{};t%2?I(Object(r),!0).forEach(function(s){Fe(e,s,r[s])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):I(Object(r)).forEach(function(s){Object.defineProperty(e,s,Object.getOwnPropertyDescriptor(r,s))})}return e}function Fe(e,t,r){return t=Ie(t),t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function Ie(e){var t=Be(e,"string");return typeof t=="symbol"?t:t+""}function Be(e,t){if(typeof e!="object"||!e)return e;var r=e[Symbol.toPrimitive];if(r!==void 0){var s=r.call(e,t);if(typeof s!="object")return s;throw new TypeError("@@toPrimitive must return a primitive value.")}return(t==="string"?String:Number)(e)}function K(e){return e&&e.map((t,r)=>j.createElement(t.tag,S({key:r},t.attr),K(t.child)))}function O(e){return t=>j.createElement(Re,z({attr:S({},e.attr)},t),K(e.child))}function Re(e){var t=r=>{var{attr:s,size:o,title:n}=e,i=Ae(e,Me),c=o||r.size||"1em",d;return r.className&&(d=r.className),e.className&&(d=(d?d+" ":"")+e.className),j.createElement("svg",z({stroke:"currentColor",fill:"currentColor",strokeWidth:"0"},r.attr,s,i,{className:d,style:S(S({color:e.color||r.color},r.style),e.style),height:c,width:c,xmlns:"http://www.w3.org/2000/svg"}),n&&j.createElement("title",null,n),e.children)};return F!==void 0?j.createElement(F.Consumer,null,r=>t(r)):t(G)}function Ve(e){return O({attr:{viewBox:"0 0 448 512"},child:[{tag:"path",attr:{d:"M0 464c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V192H0v272zm320-196c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-40zm0 128c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-40zM192 268c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-40zm0 128c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-40zM64 268c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H76c-6.6 0-12-5.4-12-12v-40zm0 128c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H76c-6.6 0-12-5.4-12-12v-40zM400 64h-48V16c0-8.8-7.2-16-16-16h-32c-8.8 0-16 7.2-16 16v48H160V16c0-8.8-7.2-16-16-16h-32c-8.8 0-16 7.2-16 16v48H48C21.5 64 0 85.5 0 112v48h448v-48c0-26.5-21.5-48-48-48z"},child:[]}]})(e)}function B(e){return O({attr:{viewBox:"0 0 448 512"},child:[{tag:"path",attr:{d:"M400 224h-24v-72C376 68.2 307.8 0 224 0S72 68.2 72 152v72H48c-26.5 0-48 21.5-48 48v192c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V272c0-26.5-21.5-48-48-48zm-104 0H152v-72c0-39.7 32.3-72 72-72s72 32.3 72 72v72z"},child:[]}]})(e)}function Te(e){return O({attr:{viewBox:"0 0 448 512"},child:[{tag:"path",attr:{d:"M416 208H272V64c0-17.67-14.33-32-32-32h-32c-17.67 0-32 14.33-32 32v144H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h144v144c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32V304h144c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32z"},child:[]}]})(e)}function R(e){return O({attr:{viewBox:"0 0 352 512"},child:[{tag:"path",attr:{d:"M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"},child:[]}]})(e)}function k(e){return O({attr:{viewBox:"0 0 448 512"},child:[{tag:"path",attr:{d:"M400 256H152V152.9c0-39.6 31.7-72.5 71.3-72.9 40-.4 72.7 32.1 72.7 72v16c0 13.3 10.7 24 24 24h32c13.3 0 24-10.7 24-24v-16C376 68 307.5-.3 223.5 0 139.5.3 72 69.5 72 153.5V256H48c-26.5 0-48 21.5-48 48v160c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V304c0-26.5-21.5-48-48-48z"},child:[]}]})(e)}const We=()=>{const[e,t]=p.useState([]),[r,s]=p.useState(!0),[o,n]=p.useState(!1),[i,c]=p.useState(!1),[d,f]=p.useState(null),[u,h]=p.useState({name:"",startDate:"",endDate:"",note:""}),[x,A]=p.useState(""),C=async()=>{try{s(!0);const{data:l}=await P.get("/fiscal-periods");t(l)}catch{m.error("فشل في جلب الفترات المالية")}finally{s(!1)}};p.useEffect(()=>{C()},[]);const Q=async l=>{l.preventDefault();try{await P.post("/fiscal-periods",u),m.success("تم إنشاء الفترة بنجاح"),n(!1),h({name:"",startDate:"",endDate:"",note:""}),C()}catch(D){m.error(D.response?.data?.message||"فشل إنشاء الفترة")}},U=async l=>{if(window.confirm(`هل أنت متأكد من إغلاق الفترة "${l.name}"؟ لن يمكن إضافة قيود جديدة في هذه الفترة.`))try{await P.post(`/fiscal-periods/${l._id}/close`),m.success("تم إغلاق الفترة بنجاح"),C()}catch{m.error("فشل إغلاق الفترة")}},J=async l=>{l.preventDefault();try{await P.post(`/fiscal-periods/${d._id}/reopen`,{reason:x}),m.success("تم إعادة فتح الفترة بنجاح"),c(!1),A(""),f(null),C()}catch{m.error("فشل إعادة فتح الفترة")}};return a.jsxs("div",{className:"animate-in fade-in",children:[a.jsxs("div",{className:"p-6",children:[a.jsxs("div",{className:"flex justify-between items-center mb-6",children:[a.jsxs("h1",{className:"text-2xl font-bold flex items-center gap-2",children:[a.jsx(Ve,{className:"text-blue-600"}),"إدارة الفترات المالية"]}),a.jsxs("button",{onClick:()=>n(!0),className:"bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition",children:[a.jsx(Te,{}),"فترة جديدة"]})]}),a.jsx("div",{className:"bg-white rounded-xl shadow-sm border overflow-hidden",children:a.jsxs("table",{className:"w-full text-right",children:[a.jsx("thead",{className:"bg-gray-50 border-b",children:a.jsxs("tr",{children:[a.jsx("th",{className:"p-4 font-semibold text-gray-600",children:"اسم الفترة"}),a.jsx("th",{className:"p-4 font-semibold text-gray-600",children:"من تاريخ"}),a.jsx("th",{className:"p-4 font-semibold text-gray-600",children:"إلى تاريخ"}),a.jsx("th",{className:"p-4 font-semibold text-gray-600",children:"الحالة"}),a.jsx("th",{className:"p-4 font-semibold text-gray-600",children:"تفاصيل"}),a.jsx("th",{className:"p-4 font-semibold text-gray-600",children:"إجراءات"})]})}),a.jsx("tbody",{className:"divide-y",children:r?a.jsx("tr",{children:a.jsx("td",{colSpan:"6",className:"p-8 text-center text-gray-500",children:"جاري التحميل..."})}):e.length===0?a.jsx("tr",{children:a.jsx("td",{colSpan:"6",className:"p-8 text-center text-gray-500",children:"لا توجد فترات مالية معرفة"})}):e.map(l=>a.jsxs("tr",{className:"hover:bg-gray-50",children:[a.jsx("td",{className:"p-4 font-medium",children:l.name}),a.jsx("td",{className:"p-4 text-gray-600",children:new Date(l.startDate).toLocaleDateString("ar-LY")}),a.jsx("td",{className:"p-4 text-gray-600",children:new Date(l.endDate).toLocaleDateString("ar-LY")}),a.jsx("td",{className:"p-4",children:l.isClosed?a.jsxs("span",{className:"inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium",children:[a.jsx(B,{size:12})," مغلقة"]}):a.jsxs("span",{className:"inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium",children:[a.jsx(k,{size:12})," مفتوحة"]})}),a.jsxs("td",{className:"p-4 text-sm text-gray-500",children:[l.isClosed&&a.jsxs("div",{children:[a.jsxs("div",{children:["أغلقت بواسطة: ",l.closedBy?.name||"النظام"]}),a.jsx("div",{className:"text-xs",children:new Date(l.closedAt).toLocaleString()}),l.reopenedBy&&a.jsx("div",{className:"mt-1 text-orange-600",children:"تمت إعادة الفتح سابقاً"})]}),!l.isClosed&&l.reopenedBy&&a.jsxs("div",{children:[a.jsxs("div",{children:["فتح بواسطة: ",l.reopenedBy?.name]}),a.jsx("div",{className:"text-xs",children:new Date(l.reopenedAt).toLocaleString()})]})]}),a.jsx("td",{className:"p-4",children:l.isClosed?a.jsxs("button",{onClick:()=>{f(l),c(!0)},className:"text-orange-600 hover:bg-orange-50 px-3 py-1 rounded border border-orange-200 transition text-sm flex items-center gap-1",title:"إعادة فتح الفترة (للضرورة)",children:[a.jsx(k,{size:14})," إعادة فتح"]}):a.jsxs("button",{onClick:()=>U(l),className:"text-red-600 hover:bg-red-50 px-3 py-1 rounded border border-red-200 transition text-sm flex items-center gap-1",title:"إغلاق الفترة",children:[a.jsx(B,{size:14})," إغلاق"]})})]},l._id))})]})})]}),o&&a.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:a.jsxs("div",{className:"bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden",children:[a.jsxs("div",{className:"p-6 border-b bg-gray-50 flex justify-between items-center",children:[a.jsx("h2",{className:"text-xl font-bold",children:"فترة مالية جديدة"}),a.jsx("button",{onClick:()=>n(!1),className:"text-gray-400 hover:text-gray-600",children:a.jsx(R,{})})]}),a.jsxs("form",{onSubmit:Q,className:"p-6 space-y-4",children:[a.jsxs("div",{children:[a.jsx("label",{className:"block text-sm font-medium mb-1",children:"اسم الفترة"}),a.jsx("input",{type:"text",required:!0,placeholder:"مثال: السنة المالية 2025",className:"w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500",value:u.name,onChange:l=>h({...u,name:l.target.value})})]}),a.jsxs("div",{className:"grid grid-cols-2 gap-4",children:[a.jsxs("div",{children:[a.jsx("label",{className:"block text-sm font-medium mb-1",children:"من تاريخ"}),a.jsx("input",{type:"date",required:!0,className:"w-full border rounded-lg p-2",value:u.startDate,onChange:l=>h({...u,startDate:l.target.value})})]}),a.jsxs("div",{children:[a.jsx("label",{className:"block text-sm font-medium mb-1",children:"إلى تاريخ"}),a.jsx("input",{type:"date",required:!0,className:"w-full border rounded-lg p-2",value:u.endDate,onChange:l=>h({...u,endDate:l.target.value})})]})]}),a.jsxs("div",{children:[a.jsx("label",{className:"block text-sm font-medium mb-1",children:"ملاحظات"}),a.jsx("textarea",{className:"w-full border rounded-lg p-2",rows:"2",value:u.note,onChange:l=>h({...u,note:l.target.value})})]}),a.jsxs("div",{className:"flex justify-end gap-2 pt-4",children:[a.jsx("button",{type:"button",onClick:()=>n(!1),className:"px-4 py-2 text-gray-600 hover:bg-gray-100 rounded",children:"إلغاء"}),a.jsx("button",{type:"submit",className:"px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700",children:"حفظ"})]})]})]})}),i&&a.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:a.jsxs("div",{className:"bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden",children:[a.jsxs("div",{className:"p-6 border-b bg-orange-50 flex justify-between items-center text-orange-800",children:[a.jsxs("h2",{className:"text-xl font-bold flex items-center gap-2",children:[a.jsx(k,{}),"إعادة فتح فترة مغلقة"]}),a.jsx("button",{onClick:()=>c(!1),className:"text-orange-600 hover:text-orange-800",children:a.jsx(R,{})})]}),a.jsxs("form",{onSubmit:J,className:"p-6 space-y-4",children:[a.jsx("div",{className:"bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-800",children:"تنبيه: إعادة فتح الفترة قد يؤدي إلى تغييرات في التقارير المالية التاريخية. يجب توخي الحذر."}),a.jsxs("div",{children:[a.jsx("label",{className:"block text-sm font-medium mb-1",children:"سبب إعادة الفتح (مطلوب)"}),a.jsx("textarea",{required:!0,placeholder:"اشرح سبب الحاجة لإعادة فتح الفترة... (سيتم تسجيله في سجلات التدقيق)",className:"w-full border rounded-lg p-2 focus:ring-2 focus:ring-orange-500",rows:"3",value:x,onChange:l=>A(l.target.value)})]}),a.jsxs("div",{className:"flex justify-end gap-2 pt-4",children:[a.jsx("button",{type:"button",onClick:()=>c(!1),className:"px-4 py-2 text-gray-600 hover:bg-gray-100 rounded",children:"إلغاء"}),a.jsx("button",{type:"submit",className:"px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700",children:"تأكيد الفتح"})]})]})]})})]})};export{We as default};
