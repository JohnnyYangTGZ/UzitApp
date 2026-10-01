import Header from './Header';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  return (
    <div className="bg-surface-background text-on-surface min-h-screen">
      <Header />
      <Sidebar />
      <main className="ml-64 pt-24 px-8 pb-12">
        {children}
      </main>
      <footer className="ml-64 p-8 border-t border-slate-200 text-slate-500 text-sm flex justify-between items-center bg-white mt-auto">
        <div>© 2023 Uzit Operations. All rights reserved.</div>
        <div className="flex gap-6">
          <a className="hover:text-primary transition-colors" href="#">Privacy Policy</a>
          <a className="hover:text-primary transition-colors" href="#">Help Center</a>
          <a className="hover:text-primary transition-colors" href="#">Support</a>
        </div>
      </footer>
    </div>
  );
}
