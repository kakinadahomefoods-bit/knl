import './styles.css';import type {Metadata} from 'next';
export const metadata:Metadata={title:'Cruvita Cookies | Baked with Love',description:'Explore cookies, brownies and gift boxes from Cruvita Cookies in Nandyal, Andhra Pradesh.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
