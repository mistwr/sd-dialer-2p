import type { Metadata, Viewport } from 'next'
export const metadata: Metadata = {title:'Exclusive Solário | Área VIP',description:'Gestão de clientes, visitas e campanhas do Exclusive Solário',manifest:'/solario-exclusive.webmanifest',appleWebApp:{capable:true,title:'Exclusive Solário',statusBarStyle:'black-translucent'},icons:{icon:[{url:'/solario-exclusive-original.svg',type:'image/svg+xml'}],apple:'/solario-exclusive-original.svg'}}
export const viewport: Viewport={themeColor:'#321d39'}
export default function SolarioLayout({children}:{children:React.ReactNode}){return children}
