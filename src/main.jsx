import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { Search, Heart, MessageCircle, ShoppingBag, Plus, Bell, Menu, X, ChevronRight, MapPin, Star, ArrowRight, BookOpen, Bike, Laptop, Armchair, Shirt, SlidersHorizontal, Sparkles, Package, TrendingUp, CheckCircle2, Clock, Send, UserRound, BarChart3, LogOut, Smartphone, CarFront, Dumbbell, CookingPot, BriefcaseBusiness, House, Wrench, Repeat2, Share2, Flag, LocateFixed, BadgeCheck, ShieldAlert, Phone, Navigation } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts'
import './styles.css'

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? '/api' : 'https://kargil-marketplace1.onrender.com/api')
const formatINR = value => `₹${Number(value || 0).toLocaleString('en-IN')}`
const locations = ['Kargil', 'Drass', 'Sankoo', 'Zanskar', 'Shargole', 'Taisuru', 'Barsoo', 'Other Ladakh locations']
const canonicalCategory = value => ({
  Books: 'Books & Study',
  Electronics: 'Mobiles & Electronics',
  Bikes: 'Vehicles',
  Clothing: 'Clothes & Fashion',
  Groceries: 'Local Products',
  'Local crafts': 'Local Products',
  'Home & hardware': 'Home & Kitchen',
  'Study Materials': 'Books & Study',
  Sports: 'Sports & Fitness',
  'Hostel Items': 'Furniture'
}[value] || value || 'Other')
const canonicalLocation = (value,index=0) => ({
  'North Quad':'Kargil',
  'West Village':'Drass',
  'East Hall':'Sankoo',
  'Maple Court':'Kargil',
  'Main Market':'Kargil',
  'Science Center':'Kargil',
  'Cedar Hall':'Zanskar',
  'Library steps':'Shargole',
  'Pine Residence':'Taisuru',
  'South Lawn':'Barsoo'
}[value] || value || locations[index%7])
const categoryNames = ['Mobiles & Electronics', 'Vehicles', 'Furniture', 'Books & Study', 'Clothes & Fashion', 'Sports & Fitness', 'Home & Kitchen', 'Jobs', 'Property & Rooms', 'Local Services', 'Local Products', 'Buy / Sell / Exchange', 'Other']
const dateValue = product => new Date(product.createdAt || product.postedAt || 0).getTime() || 0
const distanceKm = (from, to) => {
  if (!from || !to || !Number.isFinite(Number(to.latitude)) || !Number.isFinite(Number(to.longitude))) return null
  const radians = degrees => degrees * Math.PI / 180
  const dLat = radians(Number(to.latitude) - from.latitude)
  const dLon = radians(Number(to.longitude) - from.longitude)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(Number(to.latitude))) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  const body = await response.text()
  if (!contentType.includes('application/json')) {
    throw new Error('Backend API is not connected. Set VITE_API_BASE in the frontend deployment.')
  }
  let data
  try { data = JSON.parse(body) } catch { throw new Error('Backend returned an invalid response.') }
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data
}
function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please select image files only.'))
    if (file.size > 10 * 1024 * 1024) return reject(new Error('Each image must be smaller than 10 MB.'))
    const source = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(source)
      const scale = Math.min(1, 1400 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      const context = canvas.getContext('2d')
      if (!context) return reject(new Error('Could not process this image.'))
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.78))
    }
    image.onerror = () => {
      URL.revokeObjectURL(source)
      reject(new Error('Could not read one of the selected images.'))
    }
    image.src = source
  })
}

const seedProducts = [
  { id: '1', title: 'Calculus: Early Transcendentals', category: 'Books', price: 28, original: 64, condition: 'Like new', seller: 'Maya Chen', initials: 'MC', location: 'North Quad', rating: 4.9, image: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=800&q=80', tag: 'Popular', description: 'Clean, highlighted-free copy. Perfect for MATH 121 and MATH 122.' },
  { id: '2', title: 'Blue commuter bike', category: 'Bikes', price: 120, original: 240, condition: 'Good', seller: 'Jordan Lee', initials: 'JL', location: 'West Village', rating: 4.8, image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80', tag: 'Great deal', description: 'Recently tuned commuter bike with a sturdy lock included.' },
  { id: '3', title: 'Noise cancelling headphones', category: 'Electronics', price: 75, original: 150, condition: 'Excellent', seller: 'Sam Rivera', initials: 'SR', location: 'East Hall', rating: 5, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80', description: 'Sony headphones, battery lasts all day. Includes case and charging cable.' },
  { id: '4', title: 'IKEA study desk + lamp', category: 'Furniture', price: 45, original: 90, condition: 'Good', seller: 'Avery Patel', initials: 'AP', location: 'Maple Court', rating: 4.7, image: 'https://images.unsplash.com/photo-1518455027359-f3f8164d1b4b?auto=format&fit=crop&w=800&q=80', description: 'Moving out sale. Desk is compact and lamp has a warm/cool switch.' },
  { id: '5', title: 'Forest green hoodie', category: 'Clothing', price: 22, original: 48, condition: 'Like new', seller: 'Noah Williams', initials: 'NW', location: 'Main Market', rating: 4.9, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80', description: 'Oversized medium, worn twice. Soft heavyweight cotton.' },
  { id: '6', title: 'iPad Air 4th generation', category: 'Electronics', price: 330, original: 549, condition: 'Excellent', seller: 'Priya Shah', initials: 'PS', location: 'North Quad', rating: 5, image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80', tag: 'Verified seller', description: '64GB Wi-Fi iPad Air with pencil. No scratches, fresh reset.' },
  { id: '7', title: 'Organic chemistry model kit', category: 'Books', price: 18, original: 32, condition: 'Good', seller: 'Leo Martin', initials: 'LM', location: 'Science Center', rating: 4.6, image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80', description: 'Molecular model kit, all pieces accounted for.' },
  { id: '8', title: 'Floor mirror', category: 'Furniture', price: 30, original: 75, condition: 'Good', seller: 'Riley Kim', initials: 'RK', location: 'Cedar Hall', rating: 4.8, image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=800&q=80', description: 'Full length mirror with black metal frame.' },
  { id: '9', title: 'Mechanical keyboard', category: 'Electronics', price: 42, original: 80, condition: 'Excellent', seller: 'Chris Wong', initials: 'CW', location: 'East Hall', rating: 4.8, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80', description: 'Compact mechanical keyboard with tactile switches.' },
  { id: '10', title: 'Intro to economics textbook', category: 'Books', price: 24, original: 110, condition: 'Good', seller: 'Nina Shah', initials: 'NS', location: 'Library steps', rating: 4.7, image: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=800&q=80', description: 'Latest edition, minimal notes.' },
  { id: '11', title: 'Mini fridge', category: 'Furniture', price: 65, original: 140, condition: 'Good', seller: 'Owen Brooks', initials: 'OB', location: 'Pine Residence', rating: 4.6, image: 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=800&q=80', description: 'Quiet dorm mini fridge, cleaned and ready.' },
  { id: '12', title: 'Running shoes', category: 'Clothing', price: 35, original: 90, condition: 'Like new', seller: 'Zoe Allen', initials: 'ZA', location: 'South Lawn', rating: 4.9, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80', description: 'Size 9 running shoes worn only twice.' },
  { id: '13', title: 'Desk plant bundle', category: 'Furniture', price: 16, original: 30, condition: 'Excellent', seller: 'Kai Morgan', initials: 'KM', location: 'Maple Court', rating: 4.8, image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80', description: 'Three low-maintenance desk plants with pots.' },
  { id: '14', title: 'USB-C monitor', category: 'Electronics', price: 145, original: 240, condition: 'Excellent', seller: 'Emi Park', initials: 'EP', location: 'North Quad', rating: 5, image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80', description: '27 inch monitor with USB-C single-cable setup.' },
  { id: '15', title: 'Floor lamp', category: 'Furniture', price: 20, original: 48, condition: 'Good', seller: 'Alex Stone', initials: 'AS', location: 'Cedar Hall', rating: 4.7, image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80', description: 'Warm light floor lamp, perfect for a dorm room.' }
]
const localSeedProducts=seedProducts.map((product,index)=>({...product,category:canonicalCategory(product.category),location:canonicalLocation(product.location,index)}))
const categories = [
  { name: 'Mobiles & Electronics', icon: Smartphone, color: 'bg-blue-100 text-blue-700' },
  { name: 'Vehicles', icon: CarFront, color: 'bg-emerald-100 text-emerald-700' },
  { name: 'Furniture', icon: Armchair, color: 'bg-purple-100 text-purple-700' },
  { name: 'Books & Study', icon: BookOpen, color: 'bg-orange-100 text-orange-700' },
  { name: 'Clothes & Fashion', icon: Shirt, color: 'bg-pink-100 text-pink-700' },
  { name: 'Sports & Fitness', icon: Dumbbell, color: 'bg-cyan-100 text-cyan-700' },
  { name: 'Home & Kitchen', icon: CookingPot, color: 'bg-amber-100 text-amber-700' },
  { name: 'Jobs', icon: BriefcaseBusiness, color: 'bg-indigo-100 text-indigo-700' },
  { name: 'Property & Rooms', icon: House, color: 'bg-teal-100 text-teal-700' },
  { name: 'Local Services', icon: Wrench, color: 'bg-yellow-100 text-yellow-700' },
  { name: 'Local Products', icon: Package, color: 'bg-lime-100 text-lime-700' },
  { name: 'Buy / Sell / Exchange', icon: Repeat2, color: 'bg-rose-100 text-rose-700' },
  { name: 'Other', icon: ShoppingBag, color: 'bg-slate-100 text-slate-700' }
]
const chartData = [{ name: 'Mon', value: 42 }, { name: 'Tue', value: 56 }, { name: 'Wed', value: 49 }, { name: 'Thu', value: 72 }, { name: 'Fri', value: 65 }, { name: 'Sat', value: 94 }, { name: 'Sun', value: 88 }]

function useStored(key, fallback) {
  const [value, setValue] = useState(() => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback } })
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue]
}
function ProfilePage({user,setUser,products,favorites}) {
  const [editing,setEditing]=useState(false)
  const [form,setForm]=useState({name:user?.name||'',phone:user?.phone||'',college:user?.college||'',area:user?.area||'',location:user?.location||''})
  const [rating,setRating]=useState({average:0,count:0})
  const [error,setError]=useState('')
  const [saved,setSaved]=useState(false)
  useEffect(()=>setForm({name:user?.name||'',phone:user?.phone||'',college:user?.college||'',area:user?.area||'',location:user?.location||''}),[user])
  useEffect(()=>{if(user?.id)fetch(`${API_BASE}/ratings/${encodeURIComponent(user.id)}`).then(readApiResponse).then(setRating).catch(()=>{})},[user?.id])
  const update=event=>setForm(current=>({...current,[event.target.name]:event.target.value}))
  const save=async event=>{
    event.preventDefault();setError('')
    try{
      const response=await fetch(`${API_BASE}/auth/me`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`******'campuskart-token')}`},body:JSON.stringify(form)})
      const data=await readApiResponse(response)
      setUser(data.user);localStorage.setItem('campuskart-user',JSON.stringify(data.user));setEditing(false);setSaved(true);setTimeout(()=>setSaved(false),2000)
    }catch(err){setError(err.message)}
  }
  if(!user)return <div className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-3xl font-black">Please log in to view your profile</h1><Link to="/login" className="mt-5 inline-block rounded-xl bg-teal px-5 py-3 font-bold text-white">Log in</Link></div>
  const mine=products.filter(product=>product.sellerId===user.id)
  const active=mine.filter(product=>!product.status||product.status==='Active').length
  const sold=mine.filter(product=>product.status==='Sold').length
  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-5"><section className="rounded-3xl bg-ink p-5 text-white sm:p-8"><div className="flex flex-wrap items-start gap-4 sm:gap-5"><div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-coral text-xl font-black sm:h-20 sm:w-20 sm:text-2xl">{user.avatar?<img src={user.avatar} alt={`${user.name} profile`} className="h-full w-full object-cover"/>:user.name?.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="text-sm text-white/60">Kargil Marketplace member</p><div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black sm:text-3xl">{user.name}</h1>{(user.emailVerified||user.phoneVerified)&&<span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800"><BadgeCheck size={14}/>Verified seller</span>}</div><p className="mt-1 break-words text-sm text-white/70">{user.email||user.phone||'Contact details not added'}</p><p className="text-sm text-white/60">{[user.college,user.area,user.location].filter(Boolean).join(' · ')||'Add your location and area'}</p></div><button onClick={()=>setEditing(value=>!value)} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold">{editing?'Close':'Edit profile'}</button></div></section>
    {editing&&<form onSubmit={save} className="mt-5 grid gap-4 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-6"><label>Name<input required name="name" value={form.name} onChange={update}/></label><label>Phone number<input name="phone" type="tel" value={form.phone} onChange={update}/>{user.phoneVerified?<span className="mt-1 block text-xs text-teal">Verified</span>:<span className="mt-1 block text-xs text-ink/45">Phone verification is not configured.</span>}</label><label>Email<input value={user.email||''} readOnly className="opacity-70"/></label><label>College / organisation<input name="college" value={form.college} onChange={update}/></label><label>Area / neighbourhood<input name="area" value={form.area} onChange={update}/></label><label>Location<input list="profile-locations" name="location" value={form.location} onChange={update}/><datalist id="profile-locations">{locations.map(place=><option key={place} value={place}/>)}</datalist></label><button className="min-h-11 rounded-xl bg-teal py-3 font-bold text-white sm:col-span-2">Save changes</button>{error&&<p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}{saved&&<p role="status" className="text-sm font-semibold text-teal sm:col-span-2">Profile updated successfully.</p>}</form>}
    <div className="mt-5 flex flex-wrap gap-3"><Link to="/my-listings" className="rounded-xl bg-teal px-4 py-3 text-sm font-bold text-white">My listings ({mine.length})</Link><Link to="/wishlist" className="rounded-xl bg-white px-4 py-3 text-sm font-bold shadow-sm">Wishlist ({favorites.length})</Link><Link to="/dashboard" className="rounded-xl bg-white px-4 py-3 text-sm font-bold shadow-sm">Seller dashboard</Link></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat icon={ShoppingBag} label="Active listings" value={active} trend="Available"/><Stat icon={CheckCircle2} label="Sold items" value={sold} trend="Completed"/><Stat icon={Heart} label="Saved items" value={favorites.length} trend="On this device"/><Stat icon={Star} label="Seller rating" value={rating.count?rating.average.toFixed(1):'—'} trend={`${rating.count} ratings`}/></div>
  </div>
}
function App() {
  const appNavigate = useNavigate()
  const [products, setProducts] = useStored('campuskart-products', localSeedProducts)
  const [favorites, setFavorites] = useStored('campuskart-favorites', [])
  const [blockedSellers, setBlockedSellers] = useStored('campuskart-blocked-sellers', [])
  const [followedSellers, setFollowedSellers] = useStored('campuskart-followed-sellers', [])
  const [selectedLocation, setSelectedLocation] = useStored('campuskart-location', 'All locations')
  const [coordinates, setCoordinates] = useState(null)
  const [cart, setCart] = useStored('campuskart-cart', [])
  const [messages, setMessages] = useStored('campuskart-messages', [])
  const [user, setUser] = useStored('campuskart-user', null)
  const [menu, setMenu] = useState(false)
  useEffect(()=>setProducts(current=>current.map((product,index)=>({...product,category:canonicalCategory(product.category),location:canonicalLocation(product.location,index)}))),[])
  useEffect(() => {
    const redirect = sessionStorage.getItem('campuskart-after-auth')
    if (user && redirect) {
      sessionStorage.removeItem('campuskart-after-auth')
      appNavigate(redirect)
    }
  }, [user, appNavigate])
  useEffect(() => {
    const token = localStorage.getItem('campuskart-token')
    if (!token) return
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Session expired')))
      .then(data => { setUser(data.user); localStorage.setItem('campuskart-user', JSON.stringify(data.user)) })
      .catch(() => { localStorage.removeItem('campuskart-token'); localStorage.removeItem('campuskart-user'); setUser(null) })
  }, [])
  useEffect(() => {
    fetch(`${API_BASE}/products`).then(r => r.ok ? r.json() : Promise.reject()).then(data => {
      if (Array.isArray(data) && data.length) setProducts(data.map((product, index) => ({
        ...localSeedProducts[index % localSeedProducts.length],
        ...product,
        image: product.image || localSeedProducts[index % localSeedProducts.length].image,
        location: canonicalLocation(product.location,index),
        original: product.original || product.price,
        condition: product.condition || (product.shopId ? 'New' : 'Used'),
        seller: product.seller || 'Kargil local shop',
        rating: product.rating || 0
      })))
    }).catch(() => {})
  }, [])
  useEffect(() => { if (products.length < localSeedProducts.length) setProducts([...products, ...localSeedProducts.slice(products.length)]) }, [])
  const toggleFavorite = id => setFavorites(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id])
  const setNearby = () => {
    if (!navigator.geolocation) return window.alert('Location services are not available in this browser.')
    navigator.geolocation.getCurrentPosition(position => {
      setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude })
    }, () => window.alert('Location permission was not granted. You can still filter by town.'), { enableHighAccuracy: false, timeout: 10000 })
  }
  const visibleProducts=products.filter(product=>product.status!=='Rejected'&&!blockedSellers.includes(product.sellerId))
  return <div className="min-h-screen bg-cream text-ink"><PageMeta /><Header menu={menu} setMenu={setMenu} cart={cart} user={user} setUser={setUser} favoritesCount={favorites.length} /><main><Routes>
    <Route path="/" element={<Home products={visibleProducts} favorites={favorites} toggleFavorite={toggleFavorite} selectedLocation={selectedLocation} setSelectedLocation={setSelectedLocation} coordinates={coordinates} setNearby={setNearby} />} />
    <Route path="/browse" element={<Browse products={visibleProducts} favorites={favorites} toggleFavorite={toggleFavorite} selectedLocation={selectedLocation} setSelectedLocation={setSelectedLocation} coordinates={coordinates} setNearby={setNearby} />} />
    <Route path="/marketplace" element={<Browse products={visibleProducts} favorites={favorites} toggleFavorite={toggleFavorite} selectedLocation={selectedLocation} setSelectedLocation={setSelectedLocation} coordinates={coordinates} setNearby={setNearby} />} />
    <Route path="/shops" element={<Shops />} />
    <Route path="/hotels" element={<Hotels />} />
    <Route path="/about" element={<About />} />
    <Route path="/product/:id" element={<Product products={visibleProducts} favorites={favorites} toggleFavorite={toggleFavorite} user={user} />} />
    <Route path="/seller/:sellerId" element={<SellerProfile followedSellers={followedSellers} setFollowedSellers={setFollowedSellers} blockedSellers={blockedSellers} setBlockedSellers={setBlockedSellers} user={user} />} />
    <Route path="/sell" element={<Sell setProducts={setProducts} user={user} selectedLocation={selectedLocation} />} />
    <Route path="/my-listings" element={<MyListings products={products} setProducts={setProducts} user={user} />} />
    <Route path="/wishlist" element={<Wishlist products={visibleProducts} favorites={favorites} toggleFavorite={toggleFavorite} />} />
    <Route path="/dashboard" element={<Dashboard products={products} user={user} />} />
    <Route path="/messages" element={<Messages user={user} />} />
    <Route path="/chat" element={<Messages user={user} />} />
    <Route path="/auth/callback" element={<AuthCallback setUser={setUser} />} />
    <Route path="/login" element={<Auth mode="login" setUser={setUser} />} />
    <Route path="/signup" element={<Auth mode="signup" setUser={setUser} />} />
    <Route path="/admin" element={<AdminDashboard products={products} setProducts={setProducts} user={user} />} />
    <Route path="/profile" element={<ProfilePage user={user} setUser={setUser} products={products} favorites={favorites} />} />
    <Route path="*" element={<NotFound />} />
  </Routes></main><Footer /></div>
}
function NotFound() {
  return <div className="mx-auto max-w-xl px-5 py-20 text-center"><p className="text-sm font-bold uppercase tracking-widest text-teal">404</p><h1 className="mt-2 text-3xl font-black">This page could not be found</h1><p className="mt-2 text-sm text-ink/55">The link may be outdated, or the address may be mistyped.</p><Link to="/" className="mt-6 inline-flex rounded-xl bg-teal px-5 py-3 font-bold text-white">Go to homepage</Link></div>
}
function Header({ menu, setMenu, cart, user, setUser, favoritesCount }) {
  const logout = () => { localStorage.removeItem('campuskart-token'); localStorage.removeItem('campuskart-user'); setUser(null) }
  return <header className="sticky top-0 z-30 border-b border-teal-900/10 bg-cream/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-5 lg:px-8"><Link to="/" className="flex items-center gap-2 text-lg font-black tracking-tight sm:text-xl"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal text-white">K</span><span>Kargil <span className="text-teal">Marketplace</span><span className="block text-[10px] font-semibold tracking-wide text-ink/50">Buy • Sell • Connect Locally</span></span></Link><nav className="hidden items-center gap-6 text-sm font-semibold lg:flex"><NavLink to="/marketplace">Marketplace</NavLink><NavLink to="/shops">Local shops</NavLink><NavLink to="/hotels">Hotels</NavLink><NavLink to="/sell">Sell an item</NavLink><NavLink to="/my-listings">My listings</NavLink><NavLink to="/wishlist">Wishlist</NavLink></nav><div className="hidden items-center gap-3 md:flex"><Link to="/chat" aria-label="Messages" className="relative rounded-full p-2 hover:bg-mint"><MessageCircle size={19}/></Link><Link to="/wishlist" aria-label="Wishlist" className="relative rounded-full p-2 hover:bg-mint"><Heart size={19}/>{favoritesCount>0&&<span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">{favoritesCount}</span>}</Link>{user ? <div className="flex items-center gap-2"><Link to="/profile" className="grid h-9 w-9 place-items-center rounded-full bg-coral font-bold text-white">{user.name?.slice(0,2).toUpperCase() || 'JD'}</Link><button onClick={logout} className="text-sm font-bold text-red-600">Logout</button></div> : <><Link to="/login" className="text-sm font-bold text-teal">Log in</Link><Link to="/signup" className="rounded-full border border-teal/20 px-4 py-2 text-sm font-bold text-teal">Sign up</Link></>}<Link to="/sell" className="rounded-full bg-teal px-4 py-2 text-sm font-bold text-white"><Plus size={16} className="mr-1 inline"/>Sell something</Link></div><button aria-label={menu?'Close navigation':'Open navigation'} className="rounded-xl p-2 hover:bg-mint md:hidden" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button></div>{menu && <div className="border-t px-5 pb-5 md:hidden"><div className="flex flex-col gap-3 pt-4 font-semibold"><NavLink onClick={() => setMenu(false)} to="/marketplace">Marketplace</NavLink><NavLink onClick={() => setMenu(false)} to="/shops">Local shops</NavLink><NavLink onClick={() => setMenu(false)} to="/hotels">Hotels</NavLink><NavLink onClick={() => setMenu(false)} to="/sell">Sell an item</NavLink><NavLink onClick={() => setMenu(false)} to="/my-listings">My listings</NavLink><NavLink onClick={() => setMenu(false)} to="/wishlist">Wishlist</NavLink><NavLink onClick={() => setMenu(false)} to="/chat">Messages</NavLink>{user?<NavLink onClick={() => setMenu(false)} to="/profile">My profile</NavLink>:<NavLink onClick={() => setMenu(false)} to="/login">Log in / Sign up</NavLink>}{user&&<button onClick={() => { logout(); setMenu(false) }} className="text-left text-red-600">Logout</button>}</div></div>}</header>
}
function PageMeta() {
  const location = useLocation()
  useEffect(() => {
    const page = location.pathname.startsWith('/product/') ? 'Product details' :
      location.pathname.startsWith('/seller/') ? 'Seller profile' :
      location.pathname === '/marketplace' || location.pathname === '/browse' ? 'Browse local listings' :
      location.pathname === '/' ? 'Buy & sell locally' : 'Kargil Marketplace'
    document.title = `${page} | Kargil Marketplace — Buy & Sell Locally`
    let description = document.querySelector('meta[name="description"]')
    if (!description) {
      description = document.createElement('meta')
      description.name = 'description'
      document.head.appendChild(description)
    }
    description.content = 'Buy, sell, and connect locally across Kargil and Ladakh.'
    let ogTitle = document.querySelector('meta[property="og:title"]')
    if (!ogTitle) {
      ogTitle = document.createElement('meta')
      ogTitle.setAttribute('property', 'og:title')
      document.head.appendChild(ogTitle)
    }
    ogTitle.setAttribute('content', document.title)
  }, [location.pathname])
  return null
}
function LocationSelect({value,onChange,compact=false}) {
  return <label className={`flex items-center gap-2 rounded-xl bg-white px-3 ${compact?'py-2':'py-3'}`}><MapPin size={17} className="shrink-0 text-teal"/><select aria-label="Select listing location" value={value} onChange={event=>onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"><option>All locations</option>{locations.map(place=><option key={place}>{place}</option>)}</select></label>
}
function Home({products, favorites, toggleFavorite,selectedLocation,setSelectedLocation,coordinates,setNearby}) {
  const [query,setQuery]=useState('')
  const navigate=useNavigate()
  const featured=products.filter(product=>product.featured===true&&product.status!=='Sold')
  const latest=[...products].sort((a,b)=>dateValue(b)-dateValue(a)).slice(0,4)
  const nearby=coordinates
    ? products.map(product=>({...product,distance:distanceKm(coordinates,product)})).filter(product=>product.distance!==null).sort((a,b)=>a.distance-b.distance).slice(0,4)
    : selectedLocation==='Other Ladakh locations'?products.filter(product=>product.location&&!locations.slice(0,7).includes(product.location)).slice(0,4)
    : selectedLocation!=='All locations'?products.filter(product=>product.location?.toLowerCase().includes(selectedLocation.toLowerCase())).slice(0,4):[]
  const searchUrl=`/marketplace?q=${encodeURIComponent(query)}&location=${encodeURIComponent(selectedLocation)}`
  return <>
    <section className="hero-grid"><div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-5 sm:py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-20">
      <div><div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-teal shadow-sm"><MapPin size={14}/> Made for Kargil & Ladakh</div><h1 className="max-w-xl text-4xl font-black leading-[1.03] tracking-tight sm:text-6xl">Buy. Sell.<br/><span className="text-teal">Connect locally.</span></h1><p className="mt-5 max-w-lg text-lg leading-relaxed text-ink/65">Discover useful finds, local services, and products from people around your town.</p>
        <form onSubmit={event=>{event.preventDefault();navigate(searchUrl)}} className="mt-7 grid max-w-2xl gap-2 rounded-2xl bg-white p-3 shadow-lg sm:grid-cols-[1fr_220px_auto]"><div className="flex items-center gap-3 rounded-xl bg-cream px-3"><Search className="shrink-0 text-ink/40" size={19}/><input value={query} onChange={event=>setQuery(event.target.value)} className="w-full bg-transparent py-3 outline-none" placeholder="Search items, services, locations" aria-label="Search listings"/></div><LocationSelect value={selectedLocation} onChange={setSelectedLocation} compact/><button className="rounded-xl bg-teal px-5 py-3 text-sm font-bold text-white">Search</button></form>
        <div className="mt-4 flex flex-wrap gap-3"><Link to="/marketplace" className="rounded-xl bg-teal px-5 py-3 text-sm font-bold text-white shadow-sm">Buy Something</Link><Link to="/sell" className="rounded-xl border border-teal/20 bg-white px-5 py-3 text-sm font-bold text-teal">Sell Something</Link></div>
      </div><div className="relative"><img loading="lazy" alt="Mountain landscape in Ladakh" className="h-[300px] w-full rounded-[2rem] object-cover shadow-2xl sm:h-[390px]" src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85"/><div className="absolute -bottom-4 left-4 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-xl sm:-left-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-mint text-teal"><ShoppingBag/></div><div><p className="text-xs text-ink/50">Your local marketplace</p><p className="font-bold">Kargil • Drass • Zanskar</p></div></div></div>
    </div></section>
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-5 lg:px-8"><div className="mb-6 flex items-end justify-between"><div><p className="mb-1 text-sm font-bold uppercase tracking-widest text-teal">Explore local</p><h2 className="text-2xl font-black sm:text-3xl">Browse by category</h2></div><Link to="/marketplace" className="flex items-center gap-1 text-sm font-bold text-teal">All listings <ArrowRight size={16}/></Link></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{categories.map(({name,icon:Icon,color})=><Link to={`/marketplace?category=${encodeURIComponent(name)}`} key={name} className="group rounded-2xl border border-ink/5 bg-white p-4 transition hover:-translate-y-1 hover:shadow-lg sm:p-5"><div className={`mb-4 grid h-11 w-11 place-items-center rounded-xl ${color}`}><Icon size={21}/></div><p className="text-sm font-bold sm:text-base">{name}</p><p className="mt-1 text-xs text-ink/45">Browse listings <ChevronRight className="inline" size={13}/></p></Link>)}</div></section>
    <ListingSection title="Featured listings" eyebrow="Featured" products={featured} favorites={favorites} toggleFavorite={toggleFavorite} empty="No promoted listings right now. Check back soon."/>
    <ListingSection title="Latest listings" eyebrow="Recently added" products={latest} favorites={favorites} toggleFavorite={toggleFavorite} empty="No listings have been posted yet."/>
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-5 lg:px-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-widest text-teal">Around you</p><h2 className="mt-1 text-2xl font-black">Nearby listings</h2></div><div className="flex flex-wrap gap-2"><LocationSelect value={selectedLocation} onChange={setSelectedLocation} compact/><button onClick={setNearby} className="flex items-center gap-2 rounded-xl border border-teal/20 bg-white px-4 py-2 text-sm font-bold text-teal"><LocateFixed size={16}/> Use my location</button></div></div>{nearby.length?<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{nearby.map(product=><ProductCard key={product.id} product={product} favorite={favorites.includes(product.id)} toggleFavorite={toggleFavorite}/>)}</div>:<div className="rounded-2xl bg-white p-6 text-sm text-ink/55">{coordinates?'No listings include shareable map coordinates yet. Use the town selector to browse nearby places.':'Choose a town or share your browser location to discover nearby listings.'}</div>}</section>
    <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-14 sm:px-5 md:grid-cols-2 lg:px-8"><article className="rounded-3xl bg-ink p-6 text-white sm:p-8"><h2 className="text-2xl font-black">How it works</h2><div className="mt-5 grid gap-4 text-sm sm:grid-cols-3"><p><b>1. Find</b><span className="mt-1 block text-white/65">Search listings near your town.</span></p><p><b>2. Connect</b><span className="mt-1 block text-white/65">Message the seller and ask questions.</span></p><p><b>3. Meet safely</b><span className="mt-1 block text-white/65">Inspect the item in person before paying.</span></p></div></article><article id="safety" className="scroll-mt-24 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8"><div className="flex items-center gap-2 text-amber-900"><ShieldAlert size={21}/><h2 className="text-xl font-black">Stay safe</h2></div><p className="mt-3 text-sm leading-relaxed text-amber-900/80">Never send money before verifying the product and seller. Meet in a public place and inspect the item before you pay.</p></article></section>
  </>
}
function ListingSection({title,eyebrow,products,favorites,toggleFavorite,empty}) {
  return <section className="mx-auto max-w-7xl px-4 py-8 sm:px-5 lg:px-8"><div className="mb-5 flex items-end justify-between"><div><p className="mb-1 text-sm font-bold uppercase tracking-widest text-teal">{eyebrow}</p><h2 className="text-2xl font-black sm:text-3xl">{title}</h2></div><Link to="/marketplace" className="flex items-center gap-1 text-sm font-bold text-teal">See all <ArrowRight size={16}/></Link></div>{products.length?<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.map(product=><ProductCard key={product.id} product={product} favorite={favorites.includes(product.id)} toggleFavorite={toggleFavorite}/>)}</div>:<div className="rounded-2xl bg-white p-6 text-sm text-ink/55">{empty}</div>}</section>
}
function ProductCard({product, favorite, toggleFavorite}) {
  return <article className="group overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
    <div className="relative"><Link to={`/product/${product.id}`} aria-label={`View ${product.title}`}><img loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]" src={product.images?.[0]||product.image} alt={product.title}/></Link>{(product.featured||product.tag)&&<span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-teal">{product.featured?'Featured':product.tag}</span>}{toggleFavorite&&<button type="button" onClick={() => toggleFavorite(product.id)} aria-label={favorite?'Remove from wishlist':'Save to wishlist'} aria-pressed={favorite} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ink shadow-sm transition hover:scale-105">{favorite ? <Heart size={18} fill="#f9735b" className="text-coral"/> : <Heart size={18}/>}</button>}</div>
    <div className="p-4"><div className="flex items-start justify-between gap-2"><Link to={`/product/${product.id}`}><h3 className="line-clamp-2 min-h-10 font-bold">{product.title}</h3></Link><span className="shrink-0 text-lg font-black">{formatINR(product.price)}</span></div><p className="mt-1 text-xs font-semibold text-teal">{canonicalCategory(product.category)}</p><div className="mt-3 flex items-center justify-between gap-2 text-xs text-ink/55"><span className="flex min-w-0 items-center gap-1 truncate"><MapPin size={13} className="shrink-0"/>{product.location||'Ladakh'}</span><span className="shrink-0 rounded-full bg-cream px-2 py-1">{product.condition||'Condition not specified'}</span></div></div>
  </article>
}
function SellerProfile({followedSellers,setFollowedSellers,blockedSellers,setBlockedSellers,user}) {
  const {sellerId}=useParams()
  const [products,setProducts]=useState([])
  const [profile,setProfile]=useState(null)
  const [rating,setRating]=useState({average:0,count:0,reviews:[]})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [showReport,setShowReport]=useState(false)
  const nav=useNavigate()
  useEffect(()=>{
    let active=true
    setLoading(true)
    setError('')
    Promise.all([
      fetch(`${API_BASE}/products?sellerId=${encodeURIComponent(sellerId)}`).then(readApiResponse),
      fetch(`${API_BASE}/ratings/${encodeURIComponent(sellerId)}`).then(readApiResponse),
      fetch(`${API_BASE}/users/${encodeURIComponent(sellerId)}`).then(readApiResponse)
    ]).then(([listings,ratings,seller])=>{
      if(!active)return
      setProducts(listings)
      setRating(ratings)
      setProfile(seller)
    }).catch(err=>{if(active)setError(err.message)}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[sellerId])
  const sellerName=profile?.name||products[0]?.seller||'Marketplace seller'
  const activeListings=products.filter(product=>product.status!=='Sold')
  const soldListings=products.filter(product=>product.status==='Sold')
  const following=followedSellers.includes(sellerId)
  const toggleFollow=()=>{
    if(!user){sessionStorage.setItem('campuskart-after-auth',`/seller/${sellerId}`);nav('/login');return}
    setFollowedSellers(current=>following?current.filter(id=>id!==sellerId):[...current,sellerId])
  }
  const blockSeller=()=>{
    if(window.confirm(`Hide listings and profile updates from ${sellerName} on this device?`)){
      setBlockedSellers(current=>current.includes(sellerId)?current:[...current,sellerId])
      nav('/marketplace')
    }
  }
  if(blockedSellers.includes(sellerId))return <div className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-2xl font-black">Seller blocked</h1><p className="mt-2 text-sm text-ink/55">Listings from this seller are hidden on this device.</p><Link to="/marketplace" className="mt-5 inline-block rounded-xl bg-teal px-5 py-3 font-bold text-white">Browse marketplace</Link></div>
  return <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
    <Link to="/marketplace" className="text-sm font-bold text-teal">← Back to marketplace</Link>
    <section className="mt-7 flex flex-col gap-5 rounded-3xl bg-ink p-6 text-white sm:flex-row sm:items-center sm:p-8">
      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-coral text-2xl font-black">{profile?.avatar?<img src={profile.avatar} alt={`${sellerName} profile`} className="h-full w-full object-cover"/>:sellerName.slice(0,2).toUpperCase()}</div>
      <div className="min-w-0 flex-1"><p className="text-sm text-white/60">Seller profile</p><div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-black">{sellerName}</h1>{profile?.verified&&<span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800"><BadgeCheck size={14}/>Verified</span>}</div><p className="mt-1 text-sm text-white/65">{[profile?.area,profile?.location].filter(Boolean).join(' · ')||'Location not provided'}{profile?.joinedAt&&` · Joined ${new Date(profile.joinedAt).toLocaleDateString(undefined,{month:'short',year:'numeric'})}`}</p><p className="mt-2 flex items-center gap-2 text-sm text-white/75"><Star size={16} fill="#fbbf24" className="text-yellow-400"/>{rating.count?`${rating.average.toFixed(1)} out of 5 · ${rating.count} ${rating.count===1?'rating':'ratings'}`:'No ratings yet'}</p></div>
      <div className="flex gap-3 text-center"><div className="rounded-2xl bg-white/10 px-5 py-3"><p className="text-xl font-black">{activeListings.length}</p><p className="text-xs text-white/60">Active</p></div><div className="rounded-2xl bg-white/10 px-5 py-3"><p className="text-xl font-black">{soldListings.length}</p><p className="text-xs text-white/60">Sold</p></div></div>
    </section>
    <div className="mt-4 flex flex-wrap gap-2"><button onClick={toggleFollow} className="rounded-xl bg-teal px-4 py-2 text-sm font-bold text-white">{following?'Following':'Follow seller'}</button><button onClick={()=>setShowReport(true)} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700">Report seller</button><button onClick={blockSeller} className="rounded-xl border border-ink/10 bg-white px-4 py-2 text-sm font-bold text-ink/70">Block seller</button></div>
    {error&&<p className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
    <section className="mt-10"><div className="mb-5"><h2 className="text-2xl font-black">Listings from {sellerName}</h2><p className="mt-1 text-sm text-ink/55">Browse items this seller has posted.</p></div>
      {loading?<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(key=><div key={key} className="overflow-hidden rounded-2xl bg-white"><div className="skeleton aspect-[4/3]"/><div className="space-y-3 p-4"><div className="skeleton h-4 w-2/3"/><div className="skeleton h-4 w-1/2"/></div></div>)}</div>:activeListings.length?<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{activeListings.map(product=><ProductCard key={product.id} product={product} favorite={false}/>)}</div>:<div className="rounded-2xl bg-white p-10 text-center"><Package className="mx-auto text-ink/30" size={30}/><p className="mt-3 font-bold">No active listings</p><p className="mt-1 text-sm text-ink/55">This seller has no items available right now.</p></div>}
    </section>
    <section className="mt-10"><div className="mb-5"><h2 className="text-2xl font-black">Seller ratings</h2><p className="mt-1 text-sm text-ink/55">Feedback shared by buyers.</p></div>{rating.reviews?.length?<div className="grid gap-4 md:grid-cols-2">{rating.reviews.map((review,index)=><article key={`${review.productId}-${index}`} className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><b>{review.reviewerName||'Marketplace buyer'}</b><span className="flex items-center gap-1 text-sm font-bold"><Star size={14} fill="#fbbf24" className="text-yellow-400"/>{review.stars}/5</span></div>{review.comment&&<p className="mt-3 text-sm leading-relaxed text-ink/65">{review.comment}</p>}<p className="mt-3 text-xs text-ink/40">{review.createdAt?new Date(review.createdAt).toLocaleDateString():'Recent review'}</p></article>)}</div>:<div className="rounded-2xl bg-white p-8 text-sm text-ink/55">This seller has not received a rating yet.</div>}</section>
    {showReport&&<ReportDialog targetType="seller" targetId={sellerId} targetName={sellerName} user={user} onClose={()=>setShowReport(false)} onLogin={()=>{sessionStorage.setItem('campuskart-after-auth',`/seller/${sellerId}`);nav('/login')}}/>}
  </div>
}
function ReportDialog({targetType,targetId,targetName,user,onClose,onLogin}) {
  const [reason,setReason]=useState('')
  const [details,setDetails]=useState('')
  const [error,setError]=useState('')
  const [submitted,setSubmitted]=useState(false)
  const [busy,setBusy]=useState(false)
  const submit=async event=>{
    event.preventDefault()
    if(!user){onLogin();return}
    if(!reason){setError('Choose a reason for your report.');return}
    setBusy(true);setError('')
    try{
      const response=await fetch(`${API_BASE}/reports`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`******'campuskart-token')}`},body:JSON.stringify({targetType,targetId,reason,details})})
      await readApiResponse(response)
      setSubmitted(true)
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-labelledby="report-title"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 id="report-title" className="text-xl font-black">Report {targetType}</h2><p className="mt-1 text-sm text-ink/55">{targetName}</p></div><button type="button" onClick={onClose} aria-label="Close report" className="rounded-lg px-3 py-2 hover:bg-cream"><X size={18}/></button></div>{submitted?<div className="mt-5"><p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Thanks. Your report has been submitted for moderator review.</p><button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-teal py-3 font-bold text-white">Done</button></div>:<><label className="mt-5">Reason<select required value={reason} onChange={event=>setReason(event.target.value)}><option value="">Select a reason</option><option>Misleading or false listing</option><option>Suspected scam</option><option>Prohibited or unsafe item</option><option>Harassment or abusive conduct</option><option>Other</option></select></label><label className="mt-4">Details (optional)<textarea maxLength="1000" rows="3" value={details} onChange={event=>setDetails(event.target.value)} placeholder="Add relevant details"/></label>{error&&<p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}<button disabled={busy} className="mt-5 min-h-11 w-full rounded-xl bg-red-700 px-4 py-3 font-bold text-white disabled:opacity-60">{busy?'Submitting…':'Submit report'}</button></>}</form></div>
}
function Browse({products,favorites,toggleFavorite,selectedLocation,setSelectedLocation,coordinates,setNearby}) {
  const [params,setParams]=useSearchParams()
  const [query,setQuery]=useState(params.get('q')||'')
  const [category,setCategory]=useState(params.get('category')||'All')
  const [locationFilter,setLocationFilter]=useState(params.get('location')||selectedLocation||'All locations')
  const [condition,setCondition]=useState('All conditions')
  const [minimum,setMinimum]=useState('')
  const [maximum,setMaximum]=useState('')
  const [sort,setSort]=useState('newest')
  const [showFilters,setShowFilters]=useState(false)
  useEffect(()=>{setQuery(params.get('q')||'');setCategory(params.get('category')||'All')},[params])
  const updateQuery=(key,value)=>{
    const next=new URLSearchParams(params)
    if(value&&value!=='All'&&value!=='All locations')next.set(key,value)
    else next.delete(key)
    setParams(next,{replace:true})
    if(key==='location')setLocationFilter(value)
    if(key==='category')setCategory(value||'All')
  }
  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase()
    const result=products.filter(product=>{
      const categoryMatches=category==='All'||canonicalCategory(product.category)===category
      const searchText=[product.title,product.description,product.category,product.location,...(product.tags||[])].join(' ').toLowerCase()
      const matchesLocation=locationFilter==='All locations'||(locationFilter==='Other Ladakh locations'?Boolean(product.location)&&!locations.slice(0,7).includes(product.location):(product.location||'').toLowerCase().includes(locationFilter.toLowerCase()))
      const price=Number(product.price)||0
      const matchesPrice=(!minimum||price>=Number(minimum))&&(!maximum||price<=Number(maximum))
      const matchesCondition=condition==='All conditions'||(condition==='New'?product.condition==='New':product.condition!=='New')
      return categoryMatches&&(!term||searchText.includes(term))&&matchesLocation&&matchesPrice&&matchesCondition
    })
    return result.sort((first,second)=>{
      if(sort==='price-asc')return Number(first.price)-Number(second.price)
      if(sort==='price-desc')return Number(second.price)-Number(first.price)
      if(sort==='nearby'){
        const firstDistance=distanceKm(coordinates,first)
        const secondDistance=distanceKm(coordinates,second)
        if(firstDistance!==null&&secondDistance!==null)return firstDistance-secondDistance
        const firstMatch=locationFilter!=='All locations'&&(first.location||'').toLowerCase().includes(locationFilter.toLowerCase())
        const secondMatch=locationFilter!=='All locations'&&(second.location||'').toLowerCase().includes(locationFilter.toLowerCase())
        return Number(secondMatch)-Number(firstMatch)
      }
      return dateValue(second)-dateValue(first)
    })
  },[products,query,category,locationFilter,condition,minimum,maximum,sort,coordinates])
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 lg:px-8"><div className="mb-7"><p className="text-sm font-bold uppercase tracking-widest text-teal">Kargil & Ladakh marketplace</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Find something nearby</h1><p className="mt-2 text-ink/55">Search local items, services, and listings across Ladakh.</p></div>
    <div className="grid gap-3 rounded-2xl bg-white p-3 shadow-sm md:grid-cols-[1fr_220px_auto]"><div className="flex items-center gap-3 rounded-xl bg-cream px-4"><Search size={19} className="shrink-0 text-ink/40"/><input value={query} onChange={event=>setQuery(event.target.value)} className="w-full bg-transparent py-3 outline-none" placeholder="Search name, category or location..." aria-label="Search products"/></div><LocationSelect value={locationFilter} onChange={value=>{setLocationFilter(value);setSelectedLocation(value);updateQuery('location',value)}} compact/><div className="flex gap-2"><select aria-label="Sort listings" value={sort} onChange={event=>setSort(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-3 text-sm font-semibold"><option value="newest">Newest</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="nearby">Nearby</option></select><button onClick={()=>setNearby()} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-ink/10 text-teal" title="Use my location" aria-label="Use my location"><LocateFixed size={18}/></button></div>
      <button onClick={()=>setShowFilters(value=>!value)} aria-expanded={showFilters} className="flex items-center justify-center gap-2 rounded-xl border border-ink/10 px-4 py-3 text-sm font-bold md:col-span-3"><SlidersHorizontal size={17}/>{showFilters?'Hide filters':'More filters'}</button>
      {showFilters&&<div className="grid gap-3 border-t border-ink/5 pt-3 sm:grid-cols-2 lg:grid-cols-4"><label>Category<select value={category} onChange={event=>updateQuery('category',event.target.value)}><option>All</option>{categories.map(item=><option key={item.name}>{item.name}</option>)}</select></label><label>Condition<select value={condition} onChange={event=>setCondition(event.target.value)}><option>All conditions</option><option>New</option><option>Used</option></select></label><label>Minimum price<input type="number" min="0" value={minimum} onChange={event=>setMinimum(event.target.value)} placeholder="₹ 0"/></label><label>Maximum price<input type="number" min="0" value={maximum} onChange={event=>setMaximum(event.target.value)} placeholder="No maximum"/></label></div>}
    </div>
    <div className="my-5 flex gap-2 overflow-x-auto pb-2">{['All',...categories.map(item=>item.name)].map(name=><button key={name} onClick={()=>updateQuery('category',name)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${category===name?'bg-teal text-white':'bg-white text-ink/60 hover:bg-mint'}`}>{name}</button>)}</div>
    <p className="mb-4 text-sm text-ink/50"><b className="text-ink">{filtered.length}</b> listings found</p>
    {filtered.length?<div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">{filtered.map(product=><ProductCard key={product.id} product={product} favorite={favorites.includes(product.id)} toggleFavorite={toggleFavorite}/>)}</div>:<div className="rounded-2xl bg-white py-16 text-center"><Search className="mx-auto mb-3 text-ink/20" size={40}/><p className="font-bold">No listings match those filters</p><p className="mt-1 text-sm text-ink/50">Try changing your search, location, or price range.</p><button onClick={()=>{setQuery('');setCondition('All conditions');setMinimum('');setMaximum('');setSelectedLocation('All locations');setLocationFilter('All locations');setParams({})}} className="mt-4 rounded-xl bg-teal px-4 py-2 text-sm font-bold text-white">Clear filters</button></div>}
  </div>
}
function ProductLegacy({products, favorites, toggleFavorite, cart, setCart, messages, setMessages}) { const {id}=useParams(); const p=products.find(x=>x.id===id)||products[0]; const nav=useNavigate(); const [sent,setSent]=useState(false); const add=()=>{if(!cart.includes(p.id))setCart([...cart,p.id]);setSent(true);setTimeout(()=>setSent(false),1800)}; return <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8"><Link to="/browse" className="text-sm font-bold text-teal">← Back to browse</Link><div className="mt-8 grid gap-10 lg:grid-cols-2"><div><img className="h-[420px] w-full rounded-3xl object-cover shadow-xl" src={p.image}/><div className="mt-4 grid grid-cols-3 gap-3"><img className="h-24 w-full rounded-xl object-cover opacity-60" src={p.image}/><div className="rounded-xl bg-mint"/><div className="rounded-xl bg-orange-100"/></div></div><div className="py-2"><div className="flex items-start justify-between"><div><span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-teal">{p.category}</span><h1 className="mt-4 text-4xl font-black">{p.title}</h1></div><button onClick={()=>toggleFavorite(p.id)} className="rounded-full border p-3">{favorites.includes(p.id)?<Heart fill="#f9735b" className="text-coral"/>:<Heart/>}</button></div><div className="mt-4 flex items-center gap-4"><span className="text-3xl font-black">{formatINR(p.price)}</span><span className="text-lg text-ink/35 line-through">{formatINR(p.original)}</span><span className="rounded bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700">Save {Math.round((1-p.price/p.original)*100)}%</span></div><p className="mt-6 leading-relaxed text-ink/65">{p.description}</p><div className="my-7 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-white p-4"><p className="text-xs text-ink/45">Condition</p><b>{p.condition}</b></div><div className="rounded-xl bg-white p-4"><p className="text-xs text-ink/45">Meetup spot</p><b className="flex items-center gap-1"><MapPin size={14} className="text-teal"/>{p.location}</b></div></div><div className="flex items-center gap-3 border-y py-5"><div className="grid h-11 w-11 place-items-center rounded-full bg-coral font-bold text-white">{p.initials}</div><div><b>{p.seller}</b><p className="flex items-center gap-1 text-xs text-ink/50"><Star size={12} fill="#fbbf24" className="text-yellow-400"/> {p.rating} · trusted seller</p></div><button onClick={()=>{setMessages([...messages,{from:'You',text:`Hi ${p.seller}, is "${p.title}" still available?`}]);nav('/messages')}} className="ml-auto rounded-xl border border-teal px-4 py-2 text-sm font-bold text-teal"><MessageCircle size={16} className="mr-1 inline"/> Message</button></div><button onClick={add} className="mt-6 w-full rounded-xl bg-teal py-4 font-bold text-white shadow-lg hover:bg-teal/90">{sent?<><CheckCircle2 className="mr-2 inline" size={19}/> Added to your bag</>:<><ShoppingBag className="mr-2 inline" size={19}/> Reserve this item</>}</button></div></div></div> }
function Product({products,favorites,toggleFavorite,user}) {
  const {id}=useParams()
  const product=products.find(item=>String(item.id)===id)
  const nav=useNavigate()
  const [offer,setOffer]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [rating,setRating]=useState(0)
  const [review,setReview]=useState('')
  const [ratingMessage,setRatingMessage]=useState('')
  const [selectedImage,setSelectedImage]=useState(0)
  const [sellerRating,setSellerRating]=useState({average:0,count:0})
  const [sellerInfo,setSellerInfo]=useState(null)
  const [showReport,setShowReport]=useState(false)
  const [shareMessage,setShareMessage]=useState('')
  const gallery=product?.images?.length?product.images:[product?.image].filter(Boolean)
  useEffect(()=>{
    if(!product?.sellerId) return
    fetch(`${API_BASE}/ratings/${product.sellerId}`)
      .then(readApiResponse)
      .then(setSellerRating)
      .catch(()=>{})
    fetch(`${API_BASE}/users/${encodeURIComponent(product.sellerId)}`)
      .then(readApiResponse)
      .then(setSellerInfo)
      .catch(()=>{})
  },[product?.sellerId])
  useEffect(()=>setSelectedImage(0),[product?.id])
  useEffect(()=>{
    if(!product)return
    document.title=`${product.title} for ${formatINR(product.price)} | Kargil Marketplace`
    let description=document.querySelector('meta[name="description"]')
    if(!description){description=document.createElement('meta');description.name='description';document.head.appendChild(description)}
    description.content=`${product.title} for ${formatINR(product.price)} in ${product.location||'Ladakh'}. ${product.description||'Buy locally on Kargil Marketplace.'}`
    const setProperty=(property,content)=>{
      let meta=document.querySelector(`meta[property="${property}"]`)
      if(!meta){meta=document.createElement('meta');meta.setAttribute('property',property);document.head.appendChild(meta)}
      meta.setAttribute('content',content)
    }
    setProperty('og:title',document.title)
    setProperty('og:description',description.content)
    setProperty('og:image',gallery[0]||'')
  },[product])
  if(!product) return <div className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-3xl font-black">Listing not found</h1><Link to="/marketplace" className="mt-5 inline-block text-teal">Back to marketplace</Link></div>
  const shareListing=async()=>{
    const shareData={title:product.title,text:`${product.title} for ${formatINR(product.price)} in ${product.location||'Ladakh'}`,url:window.location.href}
    try{
      if(navigator.share)await navigator.share(shareData)
      else {await navigator.clipboard.writeText(shareData.url);setShareMessage('Listing link copied.')}
    }catch(error){if(error.name!=='AbortError')setShareMessage('Unable to share this listing from this browser.')}
  }
  const startConversation=async()=> {
    if(!user) { sessionStorage.setItem('campuskart-after-auth',`/product/${product.id}`); nav('/login'); return }
    if(!product.sellerId) { setError('This sample listing does not have a registered seller account to message.'); return }
    if(product.sellerId===user.id) { setError('This is your listing. Buyers will message you from their account.'); return }
    setBusy(true); setError('')
    try {
      const response=await fetch(`${API_BASE}/messages/conversations`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('campuskart-token')}`},body:JSON.stringify({productId:product.id,text:`Hi ${product.seller}, I’m interested in "${product.title}". Is it available?`,offerAmount:offer?Number(offer):undefined})})
      const conversation=await readApiResponse(response)
      nav(`/messages?conversation=${encodeURIComponent(conversation.id)}`)
    } catch(err) { setError(err.message) } finally { setBusy(false) }
  }
  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-5 sm:py-10 lg:px-8"><Link to="/marketplace" className="text-sm font-bold text-teal">← Back to marketplace</Link><div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-10"><div><img className="aspect-[4/3] max-h-[560px] w-full rounded-3xl bg-white object-contain shadow-xl" src={gallery[selectedImage]} alt={`${product.title}, photo ${selectedImage+1}`}/>{gallery.length>1&&<div className="mt-4 grid grid-cols-4 gap-3">{gallery.map((image,index)=><button key={`${image}-${index}`} onClick={()=>setSelectedImage(index)} className={`overflow-hidden rounded-xl border-2 ${selectedImage===index?'border-teal':'border-transparent'}`} aria-label={`Show photo ${index+1}`} aria-pressed={selectedImage===index}><img loading="lazy" className="aspect-square w-full object-cover" src={image} alt={`${product.title} photo ${index+1}`}/></button>)}</div>}</div>
    <div className="py-2"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-teal">{canonicalCategory(product.category)}</span><h1 className="mt-3 text-3xl font-black sm:text-4xl">{product.title}</h1></div><div className="flex gap-2"><button onClick={()=>toggleFavorite(product.id)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-white" aria-label={favorites.includes(product.id)?'Remove from wishlist':'Save to wishlist'}>{favorites.includes(product.id)?<Heart fill="#f9735b" className="text-coral"/>:<Heart/>}</button><button onClick={shareListing} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-white" aria-label="Share listing"><Share2 size={18}/></button></div></div>
      <p className="mt-4 text-3xl font-black">{formatINR(product.price)}</p><p className="mt-5 whitespace-pre-wrap leading-relaxed text-ink/70">{product.description}</p>
      {product.tags?.length>0&&<div className="mt-4 flex flex-wrap gap-2">{product.tags.map(tag=><span key={tag} className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink/65">#{tag}</span>)}</div>}
      <div className="my-6 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-white p-4"><p className="text-xs text-ink/45">Condition</p><b>{product.condition||'Not specified'}</b></div><div className="rounded-xl bg-white p-4"><p className="text-xs text-ink/45">Location</p><b className="flex items-center gap-1"><MapPin size={14} className="text-teal"/>{product.location||'Ladakh'}</b></div><div className="rounded-xl bg-white p-4"><p className="text-xs text-ink/45">Posted</p><b>{dateValue(product)?new Date(dateValue(product)).toLocaleDateString():'Date unavailable'}</b></div></div>
        <div className="flex items-center gap-3 border-y py-5"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-coral font-bold text-white">{sellerInfo?.avatar?<img src={sellerInfo.avatar} alt="" className="h-full w-full object-cover"/>:product.initials||product.seller?.slice(0,2).toUpperCase()}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link to={product.sellerId?`/seller/${product.sellerId}`:'#'} onClick={event=>{if(!product.sellerId)event.preventDefault()}} className="font-bold hover:text-teal">{sellerInfo?.name||product.seller}</Link>{sellerInfo?.verified&&<span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700"><BadgeCheck size={13}/>Verified</span>}</div><p className="mt-1 flex items-center gap-1 text-xs text-ink/50"><Star size={12} fill="#fbbf24" className="text-yellow-400"/> {sellerRating.count?sellerRating.average.toFixed(1):'No ratings yet'} · {sellerRating.count} ratings</p>{product.sellerId&&<Link to={`/seller/${product.sellerId}`} className="mt-1 inline-block text-xs font-bold text-teal">View seller profile</Link>}</div></div>
      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><ShieldAlert size={17} className="mr-2 inline"/>Never send money before verifying the product and seller. Meet and inspect in person.</div>
      <label className="mt-5">Your offer (₹), optional<input type="number" min="1" max={product.price} value={offer} onChange={event=>setOffer(event.target.value)} placeholder={`Asking price ${formatINR(product.price)}`}/></label><p className="mt-2 text-xs text-ink/50">Your message and offer go directly to {product.seller}.</p>
      {error&&<p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}{shareMessage&&<p className="mt-2 text-sm font-semibold text-teal">{shareMessage}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">{product.contactPhone&&product.contactPreference==='call'&&<a href={`tel:${product.contactPhone}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-teal/20 bg-white px-3 text-sm font-bold text-teal"><Phone size={17}/>Call seller</a>}{product.contactPhone&&product.contactPreference==='whatsapp'&&<a target="_blank" rel="noreferrer" href={`https://wa.me/${String(product.contactPhone).replace(/\D/g,'')}?text=${encodeURIComponent(`Hello, I am interested in ${product.title} on Kargil Marketplace.`)}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-green-200 bg-white px-3 text-sm font-bold text-green-700">WhatsApp seller</a>}<button onClick={startConversation} disabled={busy} className="col-span-2 min-h-12 rounded-xl bg-teal py-3 font-bold text-white shadow-lg hover:bg-teal/90 disabled:opacity-60">{busy?'Sending request…':'Message seller'}</button></div>
      {product.sellerId&&<button onClick={()=>setShowReport(true)} className="mt-4 flex items-center gap-2 text-sm font-semibold text-red-700"><Flag size={15}/>Report listing</button>}
    </div></div>{showReport&&<ReportDialog targetType="listing" targetId={String(product.id)} targetName={product.title} user={user} onClose={()=>setShowReport(false)} onLogin={()=>{sessionStorage.setItem('campuskart-after-auth',`/product/${product.id}`);nav('/login')}}/>}</div>
}
function Sell({setProducts,user,selectedLocation}) {
  const nav=useNavigate()
  const [form,setForm]=useState({title:'',price:'',category:'Books & Study',condition:'Used',description:'',location:selectedLocation==='All locations'?'Kargil':selectedLocation,contactPreference:'chat',contactPhone:'',tags:''})
  const [images,setImages]=useState([])
  const [coordinates,setCoordinates]=useState(null)
  const [done,setDone]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const update=event=>setForm({...form,[event.target.name]:event.target.value})
  const captureLocation=()=>{
    if(!navigator.geolocation){setError('Location services are not available in this browser.');return}
    navigator.geolocation.getCurrentPosition(position=>{setCoordinates({latitude:position.coords.latitude,longitude:position.coords.longitude});setError('')},()=>setError('Location permission was not granted. You can still select your town.'),{enableHighAccuracy:false,timeout:10000})
  }
  const imageUpload=async event=>{
    const files=Array.from(event.target.files||[])
    event.target.value=''
    if(images.length+files.length>4){setError('Choose up to 4 photos for one listing.');return}
    setError('')
    try {
      const compressed=await Promise.all(files.map(compressImage))
      setImages(current=>current.concat(compressed).slice(0,4))
    }
    catch(err){setError(err.message)}
  }
  const submit=async event=>{
    event.preventDefault();setError('')
    if(!user){setError('Please log in before publishing a listing.');return}
    if(!images.length){setError('Add at least one photo of the item.');return}
    if(!Number.isFinite(Number(form.price))||Number(form.price)<1){setError('Enter a price greater than zero.');return}
    if(!form.location.trim()){setError('Select or enter a listing location.');return}
    if(form.contactPreference!=='chat'&&!form.contactPhone.trim()){setError('Add a phone number or choose in-app chat.');return}
    setBusy(true)
    try {
      const listing={...form,location:form.location.trim(),price:Number(form.price),image:images[0],images,createdAt:new Date().toISOString(),tags:form.tags.split(',').map(tag=>tag.trim()).filter(Boolean).slice(0,8),coordinates}
      const response=await fetch(`${API_BASE}/products`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('campuskart-token')}`},body:JSON.stringify(listing)})
      const data=await readApiResponse(response)
      setProducts(current=>[{...data,images:data.images||images,image:data.image||images[0],initials:user.name?.slice(0,2).toUpperCase()||'JD',rating:5},...current])
      setDone(true);setTimeout(()=>nav('/my-listings'),1200)
    } catch(err){setError(err.message)} finally {setBusy(false)}
  }
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-5 sm:py-12"><p className="text-sm font-bold uppercase tracking-widest text-teal">Sell locally</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Create a listing</h1><p className="mt-2 text-ink/55">Add clear details so buyers around Kargil can find it.</p>{!user&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Please log in before publishing a listing.</p>}<form onSubmit={submit} className="mt-7 space-y-5 rounded-3xl bg-white p-4 shadow-sm sm:p-6"><label>Product title<input required maxLength="100" name="title" value={form.title} onChange={update} placeholder="e.g. Handwoven wool shawl"/></label><div className="grid gap-5 sm:grid-cols-2"><label>Price (₹)<input required type="number" min="1" step="1" name="price" value={form.price} onChange={update} placeholder="Enter asking price"/></label><label>Category<select name="category" value={form.category} onChange={update}>{categories.map(category=><option key={category.name}>{category.name}</option>)}</select></label></div><div className="grid gap-5 sm:grid-cols-2"><label>Condition<select name="condition" value={form.condition} onChange={update}><option>New</option><option>Used</option></select></label><label>Location<input required list="ladakh-locations" name="location" value={form.location} onChange={update} placeholder="Town or area"/><datalist id="ladakh-locations">{locations.map(place=><option key={place} value={place}/>)}</datalist></label></div><button type="button" onClick={captureLocation} className="flex min-h-10 items-center gap-2 rounded-xl border border-teal/20 px-4 py-2 text-sm font-bold text-teal"><Navigation size={16}/>{coordinates?'Precise location attached':'Add precise location (optional)'}</button><label>Description<textarea required maxLength="2000" name="description" value={form.description} onChange={update} rows="4" placeholder="Describe its condition, features, and pickup details"/></label><label>Tags, separated by commas<input name="tags" value={form.tags} onChange={update} placeholder="winter, handmade, books"/></label><div className="grid gap-5 sm:grid-cols-2"><label>Seller contact preference<select name="contactPreference" value={form.contactPreference} onChange={update}><option value="chat">In-app chat</option><option value="call">Phone call</option><option value="whatsapp">WhatsApp</option></select></label>{form.contactPreference!=='chat'&&<label>Contact phone<input type="tel" required name="contactPhone" value={form.contactPhone} onChange={update} placeholder="+91..."/></label>}</div><label className="rounded-2xl border-2 border-dashed p-5 text-center sm:p-8"><b>Upload item photos (up to 4)</b><span className="mt-1 block text-xs font-normal text-ink/50">Images are compressed before upload.</span><input required={images.length===0} type="file" accept="image/*" multiple onChange={imageUpload} className="mx-auto mt-3 max-w-full border-0 bg-transparent p-0"/></label>{images.length>0&&<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{images.map((image,index)=><div key={`${index}-${image.slice(-16)}`} className="relative"><img src={image} alt={`Listing photo preview ${index+1}`} className="aspect-square w-full rounded-xl object-cover"/><button type="button" onClick={()=>setImages(current=>current.filter((_,i)=>i!==index))} className="absolute right-2 top-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-red-600">Remove</button></div>)}</div>}{error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}{done&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Listing published successfully. Opening My Listings…</p>}<button disabled={done||busy} className="min-h-12 w-full rounded-xl bg-teal py-4 font-bold text-white disabled:opacity-60">{busy?'Saving listing…':done?'Listing published!':'Publish listing'}</button></form></div>
}
function DashboardLegacy({products}) { return <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-widest text-teal">Seller hub</p><h1 className="mt-2 text-4xl font-black">Good morning, Jordan</h1><p className="mt-2 text-ink/55">Here’s how your marketplace is doing.</p></div><Link to="/sell" className="rounded-xl bg-teal px-4 py-3 text-center text-sm font-bold text-white"><Plus size={16} className="mr-1 inline"/> New listing</Link></div><div className="mt-8 grid gap-4 sm:grid-cols-3"><Stat icon={TrendingUp} label="Total sales" value={formatINR(684)} trend="+18.4%"/><Stat icon={Package} label="Active listings" value="12" trend="+3 this week"/><Stat icon={Star} label="Seller rating" value="4.9" trend="Top 5%"/></div><div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]"><div className="rounded-2xl bg-white p-6 shadow-sm"><div className="mb-4 flex justify-between"><div><h2 className="font-bold">Listing views</h2><p className="text-sm text-ink/45">Last 7 days</p></div><BarChart3 className="text-teal"/></div><div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f766e" stopOpacity={.28}/><stop offset="95%" stopColor="#0f766e" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:12}}/><Tooltip/><Area type="monotone" dataKey="value" stroke="#0f766e" fill="url(#fill)" strokeWidth={3}/></AreaChart></ResponsiveContainer></div></div><div className="rounded-2xl bg-ink p-6 text-white"><h2 className="font-bold">Quick tips</h2><p className="mt-2 text-sm text-white/60">Listings with 3+ photos sell 2x faster.</p><div className="mt-7 space-y-4 text-sm"><div className="flex gap-3"><CheckCircle2 className="text-mint" size={18}/><span>Add clear photos in natural light</span></div><div className="flex gap-3"><CheckCircle2 className="text-mint" size={18}/><span>Respond within 24 hours</span></div><div className="flex gap-3"><CheckCircle2 className="text-mint" size={18}/><span>Suggest a busy meetup spot</span></div></div></div></div><h2 className="mb-5 mt-10 text-2xl font-black">Your listings</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.slice(0,4).map(p=><ProductCard key={p.id} product={p} favorite={false} toggleFavorite={()=>{}}/>)}</div></div> }
function Dashboard({products,user}) {
  const [rating,setRating]=useState({average:0,count:0})
  const mine=user?products.filter(product=>product.sellerId===user.id):[]
  useEffect(()=>{
    if(!user?.id)return
    fetch(`${API_BASE}/ratings/${encodeURIComponent(user.id)}`).then(readApiResponse).then(setRating).catch(()=>{})
  },[user?.id])
  if(!user)return <div className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-3xl font-black">Log in to see your seller dashboard</h1><Link to="/login" className="mt-5 inline-block rounded-xl bg-teal px-5 py-3 font-bold text-white">Log in</Link></div>
  const active=mine.filter(product=>!product.status||product.status==='Active').length
  const sold=mine.filter(product=>product.status==='Sold').length
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-widest text-teal">Seller hub</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Welcome, {user.name}</h1><p className="mt-2 text-ink/55">A clear view of your listings and seller rating.</p></div><Link to="/sell" className="rounded-xl bg-teal px-4 py-3 text-sm font-bold text-white"><Plus size={16} className="mr-1 inline"/>New listing</Link></div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Stat icon={Package} label="Your listings" value={mine.length} trend="Manage listings"/><Stat icon={TrendingUp} label="Active listings" value={active} trend="Available now"/><Stat icon={CheckCircle2} label="Sold items" value={sold} trend="Completed"/><Stat icon={Star} label="Seller rating" value={rating.count?rating.average.toFixed(1):'—'} trend={`${rating.count} ratings`}/></div><div className="mt-9 flex items-center justify-between"><h2 className="text-2xl font-black">Your recent listings</h2><Link to="/my-listings" className="text-sm font-bold text-teal">Manage all</Link></div>{mine.length?<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">{mine.slice(0,4).map(product=><ProductCard key={product.id} product={product} favorite={false}/>)}</div>:<div className="mt-4 rounded-2xl bg-white p-8 text-center text-sm text-ink/55">You have not posted any listings yet. <Link to="/sell" className="font-bold text-teal">Create your first listing.</Link></div>}</div>
}
function Stat({icon:Icon,label,value,trend}){return <div className="rounded-2xl bg-white p-5 shadow-sm"><Icon className="text-teal" size={21}/><p className="mt-5 text-sm text-ink/50">{label}</p><div className="mt-1 flex items-end justify-between"><b className="text-3xl">{value}</b><span className="text-xs font-bold text-teal">{trend}</span></div></div>}
function MessagesLegacy({messages,setMessages}) { const [text,setText]=useState(''); const send=()=>{if(text.trim()){setMessages([...messages,{from:'You',text}]);setText('')}}; return <div className="mx-auto max-w-5xl px-5 py-10 lg:px-8"><h1 className="text-4xl font-black">Messages</h1><p className="mt-2 text-ink/55">Chat safely with students on your campus.</p><div className="mt-8 grid min-h-[500px] overflow-hidden rounded-2xl bg-white shadow-sm md:grid-cols-[260px_1fr]"><div className="border-r"><div className="border-b p-4 font-bold">Inbox <span className="ml-1 rounded-full bg-mint px-2 text-xs text-teal">2</span></div><div className="flex items-center gap-3 border-b bg-mint/50 p-4"><div className="grid h-10 w-10 place-items-center rounded-full bg-coral text-sm font-bold text-white">MC</div><div><b className="text-sm">Maya Chen</b><p className="text-xs text-ink/50">Calculus book</p></div><span className="ml-auto h-2 w-2 rounded-full bg-teal"/></div><div className="flex items-center gap-3 p-4 opacity-60"><div className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">JL</div><div><b className="text-sm">Jordan Lee</b><p className="text-xs text-ink/50">Bike pickup</p></div></div></div><div className="flex flex-col"><div className="flex items-center gap-3 border-b p-4"><div className="grid h-10 w-10 place-items-center rounded-full bg-coral text-sm font-bold text-white">MC</div><div><b>Maya Chen</b><p className="text-xs text-ink/50">Active now</p></div></div><div className="flex-1 space-y-4 p-5"><div className="max-w-sm rounded-2xl rounded-tl-sm bg-cream p-3 text-sm">Hey! Is the calculus book still available?</div>{messages.map((m,i)=><div key={i} className="ml-auto max-w-sm rounded-2xl rounded-tr-sm bg-teal p-3 text-sm text-white">{m.text}</div>)}</div><div className="flex gap-2 border-t p-4"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} className="flex-1 rounded-xl bg-cream px-4 outline-none" placeholder="Write a message..."/><button onClick={send} className="grid h-11 w-11 place-items-center rounded-xl bg-teal text-white"><Send size={17}/></button></div></div></div></div> }
function Profile({user,setUser,products,favorites}) { const [editing,setEditing]=useState(false); const [form,setForm]=useState({name:user?.name||'',phone:user?.phone||'',college:user?.college||'',area:user?.area||'',location:user?.location||''}); const [error,setError]=useState(''); const [saved,setSaved]=useState(false); useEffect(()=>setForm({name:user?.name||'',phone:user?.phone||'',college:user?.college||'',area:user?.area||'',location:user?.location||''}),[user]); const update=e=>setForm({...form,[e.target.name]:e.target.value}); const save=async e=>{e.preventDefault();setError('');try{const response=await fetch(`${API_BASE}/auth/me`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('campuskart-token')}`},body:JSON.stringify(form)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to update profile');setUser(data.user);localStorage.setItem('campuskart-user',JSON.stringify(data.user));setEditing(false);setSaved(true);setTimeout(()=>setSaved(false),2000)}catch(err){setError(err.message)}}; if(!user)return <div className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-3xl font-black">Please log in to view your profile</h1><Link to="/login" className="mt-5 inline-block rounded-xl bg-teal px-5 py-3 font-bold text-white">Log in</Link></div>; const mine=products.filter(p=>p.sellerId===user.id||p.seller===user.name); return <div className="mx-auto max-w-5xl px-5 py-10"><div className="rounded-3xl bg-ink p-8 text-white"><div className="flex items-start gap-5"><div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-coral text-2xl font-black">{user.name?.slice(0,2).toUpperCase()}</div><div className="min-w-0"><p className="text-white/60">Kargil Marketplace member</p><h1 className="text-3xl font-black">{user.name}</h1><p className="mt-1 text-sm text-white/70">{user.email || user.phone || 'Contact details not added'}</p><p className="text-sm text-white/60">{[user.college, user.area, user.location].filter(Boolean).join(' · ') || 'Add your location and area'}</p></div><button onClick={()=>setEditing(value=>!value)} className="ml-auto rounded-xl bg-white/10 px-4 py-2 text-sm font-bold">{editing?'Close':'Edit profile'}</button></div></div>{editing&&<form onSubmit={save} className="mt-6 grid gap-4 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-2"><input required name="name" value={form.name} onChange={update} placeholder="Full name"/><input name="phone" value={form.phone} onChange={update} placeholder="Phone number"/><input name="college" value={form.college} onChange={update} placeholder="College / organisation"/><input name="area" value={form.area} onChange={update} placeholder="Area / neighbourhood"/><input name="location" value={form.location} onChange={update} placeholder="City / location"/><button className="rounded-xl bg-teal py-3 font-bold text-white">Save changes</button>{error&&<p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}{saved&&<p className="text-sm font-semibold text-teal sm:col-span-2">Profile updated successfully.</p>}</form>}<div className="mt-6 flex gap-3"><Link to="/my-listings" className="rounded-xl bg-teal px-4 py-3 text-sm font-bold text-white">My listings ({mine.length})</Link><Link to="/wishlist" className="rounded-xl bg-white px-4 py-3 text-sm font-bold shadow-sm">Wishlist ({favorites.length})</Link></div><div className="mt-8 grid gap-4 sm:grid-cols-3"><Stat icon={ShoppingBag} label="Active listings" value={mine.filter(p=>p.status!=='Sold').length} trend="Manage listings"/><Stat icon={Heart} label="Saved items" value={favorites.length} trend="Keep browsing"/><Stat icon={Star} label="Rating" value="New" trend="Build trust"/></div></div> }
function Auth({mode,setUser}) { const nav=useNavigate(); const [method,setMethod]=useState('email'); const [form,setForm]=useState({name:'',email:'',phone:'',password:'',college:'',location:''}); const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const update=e=>setForm({...form,[e.target.name]:e.target.value}); const google=()=>{ window.location.href=`${API_BASE}/auth/google` }; const submit=async e=>{ e.preventDefault(); setError(''); setBusy(true); try { const endpoint=mode==='signup'?'signup':'login'; const payload=mode==='login'?(method==='phone'?{phone:form.phone,password:form.password}:{email:form.email,password:form.password}):form; const response=await fetch(`${API_BASE}/auth/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const data=await readApiResponse(response); localStorage.setItem('campuskart-token',data.token); localStorage.setItem('campuskart-user',JSON.stringify(data.user)); setUser(data.user); nav('/profile') } catch(err) { setError(err.message) } finally { setBusy(false) } }; return <div className="mx-auto max-w-md px-5 py-16"><div className="mb-8 text-center"><h1 className="text-3xl font-black">{mode==='login'?'Welcome back':'Join Kargil Marketplace'}</h1><p className="mt-2 text-sm text-ink/55">{mode==='signup'?'Create an account with Google or email.':'Sign in to continue.'}</p></div><button type="button" onClick={google} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-ink/10 bg-white py-3.5 font-bold shadow-sm hover:bg-mint"><span className="grid h-6 w-6 place-items-center rounded-full border border-ink/10 text-sm font-black">G</span> Continue with Google</button>{(mode==='signup'||mode==='login')&&<div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-ink/5 p-1 text-sm font-bold"><button type="button" onClick={()=>setMethod('email')} className={`rounded-lg py-2 ${method==='email'?'bg-white text-teal shadow-sm':''}`}>Email</button><button type="button" onClick={()=>setMethod('phone')} className={`rounded-lg py-2 ${method==='phone'?'bg-white text-teal shadow-sm':''}`}>Phone number</button></div>}<form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-7 shadow-sm">{mode==='signup'&&<><label>Name<input required name="name" value={form.name} onChange={update} placeholder="Your name"/></label><label>College / area<input name="college" value={form.college} onChange={update} placeholder="Your college"/></label><label>Location<input name="location" value={form.location} onChange={update} placeholder="Kargil"/></label></>}{method==='phone'?<label>Phone number<input required type="tel" name="phone" value={form.phone} onChange={update} placeholder="+91 98765 43210"/></label>:<label>Email<input required type="email" name="email" value={form.email} onChange={update} placeholder="you@example.com"/></label>}<label>Password<input required minLength="6" type="password" name="password" value={form.password} onChange={update} placeholder="At least 6 characters"/></label>{error&&<p className="text-sm font-semibold text-red-600">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-teal py-3.5 font-bold text-white disabled:opacity-60">{busy?'Please wait?':mode==='login'?'Log in':method==='phone'?'Create account with phone':'Create account'}</button><p className="text-center text-sm text-ink/55">{mode==='login'?<>New here? <Link className="font-bold text-teal" to="/signup">Create an account</Link></>:<>Already registered? <Link className="font-bold text-teal" to="/login">Log in</Link></>}</p></form></div> }
function MyListingsLegacy({products,setProducts}) { const mine=products.filter(p=>p.seller==='You'); const [editing,setEditing]=useState(null); const [draft,setDraft]=useState(''); const save=id=>{setProducts(ps=>ps.map(p=>p.id===id?{...p,title:draft}:p));setEditing(null)}; const sold=id=>setProducts(ps=>ps.map(p=>p.id===id?{...p,status:p.status==='Sold'?'Active':'Sold'}:p)); return <div className="mx-auto max-w-7xl px-5 py-10"><div className="flex justify-between"><div><h1 className="text-4xl font-black">My listings</h1><p className="mt-2 text-sm text-ink/55">{mine.length} item{mine.length===1?'':'s'} listed by you</p></div><Link to="/sell" className="rounded-xl bg-teal px-4 py-3 font-bold text-white">Add listing</Link></div><div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{mine.map(p=><div key={p.id}><ProductCard product={p} favorite={false} toggleFavorite={()=>{}}/><div className="mt-2 flex justify-between text-xs font-bold"><span className="rounded-full bg-mint px-2 py-1 text-teal">{p.status||'Active'}</span><button onClick={()=>sold(p.id)} className="text-teal">Mark as {p.status==='Sold'?'active':'sold'}</button></div>{editing===p.id?<div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded border px-2 py-1" value={draft} onChange={e=>setDraft(e.target.value)}/><button onClick={()=>save(p.id)} className="rounded bg-teal px-2 text-xs text-white">Save</button></div>:<button onClick={()=>{setEditing(p.id);setDraft(p.title)}} className="mt-2 text-xs font-bold">Edit listing</button>}</div>)}</div>{!mine.length&&<p className="mt-10 text-center">No listings yet. Add your first listing.</p>}</div> }
function MyListings({products,setProducts,user}) {
  const [editing,setEditing]=useState('')
  const [draft,setDraft]=useState('')
  const [busyId,setBusyId]=useState('')
  const [error,setError]=useState('')
  const mine=user?products.filter(product=>product.sellerId===user.id):[]
  const save=async product=>{
    if(!draft.trim()){setError('Listing title cannot be empty.');return}
    setBusyId(product.id);setError('')
    try{
      const response=await fetch(`${API_BASE}/products/${encodeURIComponent(product.id)}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`******'campuskart-token')}`},body:JSON.stringify({title:draft.trim()})})
      const updated=await readApiResponse(response)
      setProducts(current=>current.map(item=>item.id===updated.id?{...item,...updated}:item))
      setEditing('');setDraft('')
    }catch(err){setError(err.message)}finally{setBusyId('')}
  }
  const markSold=async product=>{
    setBusyId(product.id);setError('')
    try{
      const status=product.status==='Sold'?'Active':'Sold'
      const response=await fetch(`${API_BASE}/products/${encodeURIComponent(product.id)}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`******'campuskart-token')}`},body:JSON.stringify({status})})
      const updated=await readApiResponse(response)
      setProducts(current=>current.map(item=>item.id===updated.id?{...item,...updated}:item))
    }catch(err){setError(err.message)}finally{setBusyId('')}
  }
  const remove=async product=>{
    if(!window.confirm(`Delete "${product.title}" permanently?`))return
    setBusyId(product.id);setError('')
    try{
      const response=await fetch(`${API_BASE}/products/${encodeURIComponent(product.id)}`,{method:'DELETE',headers:{Authorization:`******'campuskart-token')}`}})
      if(!response.ok)await readApiResponse(response)
      setProducts(current=>current.filter(item=>item.id!==product.id))
    }catch(err){setError(err.message)}finally{setBusyId('')}
  }
  if(!user)return <div className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-3xl font-black">Log in to manage your listings</h1><Link to="/login" className="mt-5 inline-block rounded-xl bg-teal px-5 py-3 font-bold text-white">Log in</Link></div>
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black sm:text-4xl">My listings</h1><p className="mt-2 text-sm text-ink/55">{mine.length} listing{mine.length===1?'':'s'} by you</p></div><Link to="/sell" className="rounded-xl bg-teal px-4 py-3 font-bold text-white">Add listing</Link></div>{error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
    {mine.length?<div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">{mine.map(product=><article key={product.id}><ProductCard product={product} favorite={false}/><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-mint px-2 py-1 text-xs font-bold text-teal">{product.status||'Active'}</span><button disabled={busyId===product.id} onClick={()=>markSold(product)} className="text-xs font-bold text-teal disabled:opacity-50">Mark as {product.status==='Sold'?'active':'sold'}</button></div>{editing===product.id?<div className="mt-3 flex gap-2"><input className="min-w-0 flex-1 rounded-xl border px-2 py-2 text-sm" value={draft} onChange={event=>setDraft(event.target.value)} aria-label="Listing title"/><button disabled={busyId===product.id} onClick={()=>save(product)} className="rounded-lg bg-teal px-3 text-xs font-bold text-white">Save</button></div>:<button onClick={()=>{setEditing(product.id);setDraft(product.title)}} className="mt-3 text-xs font-bold text-teal">Edit title</button>}<button disabled={busyId===product.id} onClick={()=>remove(product)} className="ml-4 mt-3 text-xs font-bold text-red-700 disabled:opacity-50">Delete</button></article>)}</div>:<div className="mt-8 rounded-2xl bg-white py-16 text-center"><Package className="mx-auto text-ink/25" size={36}/><p className="mt-3 font-bold">No listings yet</p><p className="mt-1 text-sm text-ink/50">Post your first item for people nearby.</p><Link to="/sell" className="mt-5 inline-block rounded-xl bg-teal px-4 py-3 font-bold text-white">Create listing</Link></div>}</div>
}
function Wishlist({products,favorites,toggleFavorite}) { const saved=products.filter(p=>favorites.includes(p.id)); return <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><p className="text-sm font-bold uppercase tracking-widest text-teal">Saved for later</p><h1 className="mt-2 text-4xl font-black">Your wishlist</h1><p className="mt-2 text-ink/55">Keep an eye on items you love.</p>{saved.length?<div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">{saved.map(p=><ProductCard key={p.id} product={p} favorite toggleFavorite={toggleFavorite}/>)}</div>:<div className="mt-10 rounded-2xl bg-white py-20 text-center shadow-sm"><Heart className="mx-auto mb-3 text-coral" size={40}/><b>Your wishlist is empty</b><p className="mt-1 text-sm text-ink/50">Tap the heart on any listing to save it.</p><Link to="/marketplace" className="mt-5 inline-block rounded-xl bg-teal px-4 py-3 text-sm font-bold text-white">Browse marketplace</Link></div>}</div> }
function AdminDashboard({products,setProducts,user}) {
  const [users,setUsers]=useState([])
  const [reports,setReports]=useState([])
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [busyId,setBusyId]=useState('')
  const token=localStorage.getItem('campuskart-token')
  const authorization={Authorization:`Bearer ${token}`}
  const load=async()=>{
    if(!token){setError('Sign in with an administrator account to open moderation tools.');setLoading(false);return}
    try{
      const [userResponse,reportResponse,listingResponse]=await Promise.all([
        fetch(`${API_BASE}/users`,{headers:authorization}),
        fetch(`${API_BASE}/reports`,{headers:authorization}),
        fetch(`${API_BASE}/products/moderation/all`,{headers:authorization})
      ])
      const [userData,reportData,listingData]=await Promise.all([readApiResponse(userResponse),readApiResponse(reportResponse),readApiResponse(listingResponse)])
      setUsers(userData);setReports(reportData);setProducts(listingData);setError('')
    }catch(err){setError(err.message)}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[user?.id])
  const resolveReport=async(report,status)=>{
    setBusyId(report.id);setError('')
    try{
      const response=await fetch(`${API_BASE}/reports/${report.id}`,{method:'PATCH',headers:{...authorization,'Content-Type':'application/json'},body:JSON.stringify({status})})
      await readApiResponse(response)
      setReports(current=>current.map(item=>item.id===report.id?{...item,status}:item))
    }catch(err){setError(err.message)}finally{setBusyId('')}
  }
  const removeReportedListing=async report=>{
    if(!window.confirm(`Remove listing "${report.targetName}"? This cannot be undone.`))return
    setBusyId(report.id);setError('')
    try{
      const response=await fetch(`${API_BASE}/products/${encodeURIComponent(report.targetId)}`,{method:'DELETE',headers:authorization})
      if(!response.ok){const data=await readApiResponse(response);throw new Error(data.error||'Unable to remove listing')}
      setProducts(current=>current.filter(product=>String(product.id)!==report.targetId))
      setReports(current=>current.map(item=>item.id===report.id?{...item,status:'reviewed'}:item))
      await fetch(`${API_BASE}/reports/${report.id}`,{method:'PATCH',headers:{...authorization,'Content-Type':'application/json'},body:JSON.stringify({status:'reviewed'})}).then(readApiResponse)
    }catch(err){setError(err.message)}finally{setBusyId('')}
  }
  const blockUser=async(report)=>{
    if(!window.confirm(`Block the reported seller ${report.targetName}?`))return
    setBusyId(report.id);setError('')
    try{
      const response=await fetch(`${API_BASE}/users/${encodeURIComponent(report.targetId)}/block`,{method:'PATCH',headers:{...authorization,'Content-Type':'application/json'},body:JSON.stringify({blocked:true})})
      await readApiResponse(response)
      await resolveReport(report,'reviewed')
    }catch(err){setError(err.message)}finally{setBusyId('')}
  }
  const moderateListing=async(product,status)=>{
    setBusyId(String(product.id));setError('')
    try{
      const response=await fetch(`${API_BASE}/products/${encodeURIComponent(product.id)}`,{method:'PUT',headers:{...authorization,'Content-Type':'application/json'},body:JSON.stringify({status})})
      const updated=await readApiResponse(response)
      setProducts(current=>current.map(item=>item.id===updated.id?{...item,...updated}:item))
    }catch(err){setError(err.message)}finally{setBusyId('')}
  }
  const toggleFeatured=async product=>{
    setBusyId(String(product.id));setError('')
    try{
      const response=await fetch(`${API_BASE}/products/${encodeURIComponent(product.id)}`,{method:'PUT',headers:{...authorization,'Content-Type':'application/json'},body:JSON.stringify({featured:!product.featured})})
      const updated=await readApiResponse(response)
      setProducts(current=>current.map(item=>item.id===updated.id?{...item,...updated}:item))
    }catch(err){setError(err.message)}finally{setBusyId('')}
  }
  const setUserBlocked=async account=>{
    const blocked=!account.blocked
    const action=blocked?'Block':'Unblock'
    if(!window.confirm(`${action} ${account.name}'s account?`))return
    setBusyId(account.id);setError('')
    try{
      const response=await fetch(`${API_BASE}/users/${encodeURIComponent(account.id)}/block`,{method:'PATCH',headers:{...authorization,'Content-Type':'application/json'},body:JSON.stringify({blocked})})
      await readApiResponse(response)
      setUsers(current=>current.map(item=>item.id===account.id?{...item,blocked}:item))
    }catch(err){setError(err.message)}finally{setBusyId('')}
  }
  if(user?.role!=='admin'&&!loading)return <div className="mx-auto max-w-2xl px-5 py-20 text-center"><ShieldAlert className="mx-auto text-amber-600" size={38}/><h1 className="mt-4 text-2xl font-black">Administrator access required</h1><p className="mt-2 text-sm text-ink/55">{error||'This account does not have permission to view marketplace administration.'}</p></div>
  const pending=reports.filter(report=>report.status==='pending')
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 lg:px-8"><p className="text-sm font-bold uppercase tracking-widest text-teal">Marketplace moderation</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Admin dashboard</h1><p className="mt-2 text-sm text-ink/55">User and report data comes from the connected marketplace API.</p>{error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Stat icon={UserRound} label="Users" value={loading?'…':users.length} trend="Registered"/><Stat icon={Package} label="Listings" value={products.length} trend="Current"/><Stat icon={TrendingUp} label="Active listings" value={products.filter(product=>!product.status||product.status==='Active').length} trend="Available"/><Stat icon={CheckCircle2} label="Sold items" value={products.filter(product=>product.status==='Sold').length} trend="Completed"/><Stat icon={Flag} label="Open reports" value={loading?'…':pending.length} trend="Needs review"/></div>
    <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Reported listings & sellers</h2><p className="mt-1 text-sm text-ink/50">Review reports submitted by authenticated users.</p></div><button onClick={()=>{setLoading(true);load()}} className="rounded-xl border px-4 py-2 text-sm font-bold">Refresh</button></div>
      {loading?<div className="mt-5 space-y-3">{[1,2,3].map(item=><div key={item} className="skeleton h-16 rounded-xl"/>)}</div>:pending.length?<div className="mt-4 space-y-3">{pending.map(report=><article key={report.id} className="rounded-xl border border-ink/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-bold text-orange-800">{report.targetType}</span><h3 className="mt-2 font-bold">{report.targetName}</h3><p className="mt-1 text-sm text-ink/60">{report.reason}{report.details&&` — ${report.details}`}</p><p className="mt-1 text-xs text-ink/40">{new Date(report.createdAt).toLocaleString()}</p></div><div className="flex flex-wrap gap-2">{report.targetType==='listing'&&<button disabled={busyId===report.id} onClick={()=>removeReportedListing(report)} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Remove listing</button>}{report.targetType==='seller'&&<button disabled={busyId===report.id} onClick={()=>blockUser(report)} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Block seller</button>}<button disabled={busyId===report.id} onClick={()=>resolveReport(report,'dismissed')} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-60">Dismiss</button></div></div></article>)}</div>:<p className="mt-5 rounded-xl bg-cream p-5 text-sm text-ink/55">{loading?'Loading reports…':'No pending reports.'}</p>}</section>
    <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-black">Listing moderation</h2><p className="mt-1 text-sm text-ink/50">Approve or reject live marketplace listings and select featured items.</p></div>{products.length?<div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-cream text-xs uppercase text-ink/50"><tr><th className="p-4">Product</th><th className="p-4">Seller</th><th className="p-4">Price</th><th className="p-4">Category</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead><tbody>{products.map(product=><tr key={product.id} className="border-t"><td className="p-4 font-semibold">{product.title}</td><td className="p-4">{product.seller||'Seller unavailable'}</td><td className="p-4">{formatINR(product.price)}</td><td className="p-4">{canonicalCategory(product.category)}</td><td className="p-4">{product.status||'Active'}{product.featured&&<span className="ml-2 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">Featured</span>}</td><td className="p-4"><div className="flex gap-2"><button disabled={busyId===String(product.id)||product.status==='Active'} onClick={()=>moderateListing(product,'Active')} className="rounded-lg bg-teal px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Approve</button><button disabled={busyId===String(product.id)||product.status==='Rejected'} onClick={()=>moderateListing(product,'Rejected')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Reject</button><button disabled={busyId===String(product.id)} onClick={()=>toggleFeatured(product)} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">{product.featured?'Unfeature':'Feature'}</button></div></td></tr>)}</tbody></table></div>:<p className="p-5 text-sm text-ink/50">No listings are available for moderation.</p>}</section>
    <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-black">Registered users</h2><p className="mt-1 text-sm text-ink/50">Account information is limited to administrators.</p></div>{loading?<div className="p-5 text-sm text-ink/50">Loading users…</div>:users.length?<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-cream text-xs uppercase text-ink/50"><tr><th className="p-4">Name</th><th className="p-4">Email / phone</th><th className="p-4">Location</th><th className="p-4">Role</th><th className="p-4">Account</th></tr></thead><tbody>{users.map(account=><tr key={account.id} className="border-t"><td className="p-4 font-semibold">{account.name}</td><td className="p-4">{account.email||account.phone||'Not supplied'}</td><td className="p-4">{account.location||'Not supplied'}</td><td className="p-4">{account.role}</td><td className="p-4"><button disabled={busyId===account.id||account.role==='admin'} onClick={()=>setUserBlocked(account)} className={`rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${account.blocked?'border border-teal/20 text-teal':'border border-red-200 text-red-700'}`}>{account.role==='admin'?'Admin':account.blocked?'Unblock':'Block'}</button></td></tr>)}</tbody></table></div>:<p className="p-5 text-sm text-ink/50">No user records were returned.</p>}</section>
    <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Marketplace categories</h2><p className="mt-1 text-sm text-ink/50">Categories are currently defined in the application; persistent category management is not configured.</p><div className="mt-4 flex flex-wrap gap-2">{categoryNames.map(name=><span key={name} className="rounded-full bg-cream px-3 py-2 text-xs font-semibold">{name}</span>)}</div></section>
  </div>
}
function Admin({products,setProducts}) { return <AdminDashboard products={products} setProducts={setProducts} user={null}/> }
function Shops() {
  const [shops, setShops] = useState([])
  const [products, setProducts] = useState([])
  useEffect(() => {
    Promise.all([fetch(`${API_BASE}/shops`).then(r => r.json()), fetch(`${API_BASE}/products`).then(r => r.json())])
      .then(([shopData, productData]) => { setShops(shopData); setProducts(productData) })
      .catch(() => {
        setShops([
          { id: 'local-1', name: 'Kargil Super Mart', category: 'Groceries', location: 'Main Bazaar, Kargil', description: 'Everyday groceries and household essentials.', productIds: ['1', '7'] },
          { id: 'local-2', name: 'Ladakh Handloom House', category: 'Local crafts', location: 'Fort Road, Kargil', description: 'Warm, locally made woollens and thoughtful gifts.', productIds: ['5', '12'] }
        ])
        setProducts(seedProducts)
      })
  }, [])
  return <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><p className="text-sm font-bold uppercase tracking-widest text-teal">Around Kargil</p><h1 className="mt-2 text-4xl font-black">Local shops & goods</h1><p className="mt-2 max-w-2xl text-ink/55">Discover trusted Kargil businesses and the essentials they keep ready for you.</p><div className="mt-8 grid gap-5 md:grid-cols-2">{shops.map(shop => <article key={shop.id} className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="text-xl font-black">{shop.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-ink/55"><MapPin size={14}/>{shop.location}</p><a href={`tel:${shop.contactNumber || ''}`} className="mt-2 inline-block text-sm font-bold text-teal">{shop.contactNumber || 'Contact number not added'}</a></div><span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-teal">{shop.category}</span></div><p className="mt-4 text-sm text-ink/65">{shop.description}</p><p className="mt-4 text-xs font-bold uppercase tracking-wider text-ink/40">Available goods</p><div className="mt-2 flex flex-wrap gap-2">{shop.productIds.map(id => { const product = products.find(p => String(p.id) === String(id)); return product && <span key={id} className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold">{product.title}</span> })}</div></article>)}</div>{!shops.length && <p className="mt-10 rounded-2xl bg-white p-10 text-center text-ink/55">Local shop listings are loading. Please try again shortly.</p>}</div>
}
function Hotels() {
  const fallbackHotels = [{ id: 'hotel-fallback-1', name: 'The Kargil Heights', category: 'Hotel & restaurant', location: 'Main Bazaar, Kargil', contactNumber: '+91 98710 13001', description: 'Comfortable rooms, mountain views and a family-friendly restaurant.', rooms: [{ type: 'Deluxe room', price: 3200, available: 4 }, { type: 'Family room', price: 4800, available: 2 }], foods: ['Ladakhi thukpa', 'Momos', 'Vegetable pulao', 'Breakfast combo'] }, { id: 'hotel-fallback-2', name: 'Apricot Tree Residency', category: 'Guest house & cafe', location: 'Baroo Road, Kargil', contactNumber: '+91 98710 13002', description: 'A quiet stay with a cafe serving local snacks and hot drinks.', rooms: [{ type: 'Standard room', price: 2200, available: 6 }, { type: 'Twin room', price: 2800, available: 3 }], foods: ['Apricot cake', 'Butter tea', 'Ladakhi bread', 'Egg noodles'] }]
  const [hotels, setHotels] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'Hotel & restaurant', location: '', contactNumber: '', description: '', rooms: '', foods: '' })
  const [error, setError] = useState('')
  useEffect(() => { fetch(`${API_BASE}/hotels`).then(response => response.ok ? response.json() : Promise.reject()).then(data => setHotels(Array.isArray(data) && data.length ? data : fallbackHotels)).catch(() => setHotels(fallbackHotels)) }, [])
  const update = event => setForm({ ...form, [event.target.name]: event.target.value })
  const addHotel = async event => { event.preventDefault(); setError(''); const hotel = { ...form, rooms: form.rooms.split(',').filter(Boolean).map(room => ({ type: room.trim(), price: 0, available: 0 })), foods: form.foods.split(',').map(food => food.trim()).filter(Boolean) }; try { const response = await fetch(`${API_BASE}/hotels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hotel) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to add hotel'); setHotels(current => [...current, data]); setForm({ name: '', category: 'Hotel & restaurant', location: '', contactNumber: '', description: '', rooms: '', foods: '' }); setShowForm(false) } catch (err) { setError(err.message) } }
  return <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-widest text-teal">Stay in Kargil</p><h1 className="mt-2 text-4xl font-black">Hotels, rooms & restaurants</h1><p className="mt-2 max-w-2xl text-ink/55">Find a comfortable room, call the hotel, and explore food available on-site.</p></div><button onClick={() => setShowForm(value => !value)} className="rounded-xl bg-teal px-4 py-3 text-sm font-bold text-white">{showForm ? 'Close form' : 'Add your hotel'}</button></div>{showForm && <form onSubmit={addHotel} className="mt-8 grid gap-4 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-2"><input required name="name" value={form.name} onChange={update} placeholder="Hotel name"/><input required name="category" value={form.category} onChange={update} placeholder="Category"/><input required name="location" value={form.location} onChange={update} placeholder="Location"/><input required name="contactNumber" value={form.contactNumber} onChange={update} placeholder="Contact number"/><input required name="rooms" value={form.rooms} onChange={update} placeholder="Rooms, separated by commas"/><input required name="foods" value={form.foods} onChange={update} placeholder="Foods, separated by commas"/><textarea required name="description" value={form.description} onChange={update} placeholder="Hotel description" className="sm:col-span-2"/>{error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}<button className="rounded-xl bg-teal py-3 font-bold text-white sm:col-span-2">Save hotel</button></form>}<div className="mt-8 grid gap-6 lg:grid-cols-2">{hotels.map(hotel => <article key={hotel.id} className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black">{hotel.name}</h2><p className="mt-1 flex items-center gap-1 text-sm text-ink/55"><MapPin size={14}/>{hotel.location}</p><a href={`tel:${hotel.contactNumber}`} className="mt-2 inline-block text-sm font-bold text-teal">{hotel.contactNumber}</a></div><span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-teal">{hotel.category}</span></div><p className="mt-4 text-sm text-ink/65">{hotel.description}</p><div className="mt-6"><h3 className="font-bold">Available rooms</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{(hotel.rooms || []).map(room => <div key={room.type} className="rounded-xl bg-cream p-3 text-sm"><b>{room.type}</b><p className="mt-1 text-ink/55">{formatINR(room.price)} / night · {room.available} available</p></div>)}</div></div><div className="mt-6"><h3 className="font-bold">Restaurant & food menu</h3><div className="mt-3 flex flex-wrap gap-2">{(hotel.foods || []).map(food => <span key={food} className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">{food}</span>)}</div></div><a href={`tel:${hotel.contactNumber}`} className="mt-6 block rounded-xl bg-teal py-3 text-center text-sm font-bold text-white">Call for booking</a></article>)}</div></div>
}
function AuthCallback({setUser}) { const [params]=useSearchParams(); const nav=useNavigate(); useEffect(()=>{ const token=params.get('token'); if(!token){nav('/login');return} localStorage.setItem('campuskart-token',token); fetch(`${API_BASE}/me`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(data=>{ if(data.user){localStorage.setItem('campuskart-user',JSON.stringify(data.user));setUser(data.user);nav('/profile')} else nav('/login') }).catch(()=>nav('/login')) },[nav,params,setUser]); return <div className="mx-auto max-w-md px-5 py-20 text-center">Signing you in?</div> }
function About(){return <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8"><div className="rounded-3xl bg-ink p-8 text-white sm:p-12"><p className="text-sm font-bold uppercase tracking-widest text-mint">About Kargil Marketplace</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Built for local buying and selling.</h1><p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">Kargil Marketplace is a local digital marketplace created to make it easier for people in Kargil to discover products, support nearby shops, and buy or sell useful goods with confidence.</p></div><div className="mt-8 grid gap-6 md:grid-cols-2"><article className="rounded-2xl bg-white p-7 shadow-sm"><p className="text-sm font-bold uppercase tracking-widest text-teal">Created by</p><h2 className="mt-3 text-2xl font-black">Nassir Hussain</h2><p className="mt-3 leading-relaxed text-ink/65">Nassir Hussain created Kargil Marketplace as a practical local-commerce project for connecting customers, independent sellers, and shops through one simple platform.</p></article><article className="rounded-2xl bg-white p-7 shadow-sm"><p className="text-sm font-bold uppercase tracking-widest text-teal">Our goal</p><h2 className="mt-3 text-2xl font-black">Local goods, shared simply.</h2><p className="mt-3 leading-relaxed text-ink/65">The platform is designed to help local businesses present their available goods online, help people find products nearby, and create a stronger digital marketplace for Kargil.</p></article></div><div className="mt-8 rounded-2xl border border-teal/10 bg-mint/50 p-7"><h2 className="text-2xl font-black">What you can do here</h2><div className="mt-5 grid gap-3 text-sm text-ink/70 sm:grid-cols-3"><span>Browse local products</span><span>Discover nearby shops</span><span>List items for sale</span><span>Save products</span><span>Contact sellers</span><span>Explore shop goods</span></div></div></div>}
function Footer(){return <footer className="border-t border-ink/10 bg-white"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-5 py-8 text-sm text-ink/50 sm:flex-row lg:px-8"><div><b className="text-ink">Kargil <span className="text-teal">Marketplace</span></b><p className="mt-1">Buy • Sell • Connect Locally</p><p className="mt-2">© {new Date().getFullYear()} Kargil Marketplace</p></div><div className="flex flex-wrap gap-5"><Link to="/#safety" className="hover:text-teal">Safety tips</Link><Link to="/about" className="hover:text-teal">About & help</Link></div></div></footer>}
function Messages({user}) {
  const [searchParams,setSearchParams]=useSearchParams()
  const [conversations,setConversations]=useState([])
  const [active,setActive]=useState(null)
  const [text,setText]=useState('')
  const [offer,setOffer]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const selectedId=searchParams.get('conversation')
  const token=localStorage.getItem('campuskart-token')
  const loadConversations=async()=> {
    if(!user||!token) return
    const response=await fetch(`${API_BASE}/messages/conversations`,{headers:{Authorization:`Bearer ${token}`}})
    const data=await readApiResponse(response)
    setConversations(data)
    const target=data.find(conversation=>conversation.id===selectedId)||data[0]
    if(target&&!selectedId) setSearchParams({conversation:target.id})
    if(target) {
      const detailsResponse=await fetch(`${API_BASE}/messages/conversations/${target.id}`,{headers:{Authorization:`Bearer ${token}`}})
      setActive(await readApiResponse(detailsResponse))
    } else setActive(null)
  }
  useEffect(()=>{loadConversations().catch(err=>setError(err.message))},[user?.id,selectedId])
  useEffect(()=>{
    if(!user) return
    const interval=setInterval(()=>loadConversations().catch(err=>setError(err.message)),8000)
    return ()=>clearInterval(interval)
  },[user?.id,selectedId])
  const selectConversation=async conversation=>{
    setSearchParams({conversation:conversation.id})
    try {
      const response=await fetch(`${API_BASE}/messages/conversations/${conversation.id}`,{headers:{Authorization:`Bearer ${token}`}})
      setActive(await readApiResponse(response));setError('')
    } catch(err) { setError(err.message) }
  }
  const send=async event=>{
    event.preventDefault()
    if(!active||(!text.trim()&&!offer)) return
    setBusy(true);setError('')
    try {
      const response=await fetch(`${API_BASE}/messages/conversations/${active.id}/messages`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({text,offerAmount:offer?Number(offer):undefined})})
      const updated=await readApiResponse(response)
      setActive(updated);setText('');setOffer('')
      setConversations(current=>[updated,...current.filter(conversation=>conversation.id!==updated.id)])
    } catch(err) { setError(err.message) } finally { setBusy(false) }
  }
  const submitRating=async event=>{
    event.preventDefault()
    if(!active||!rating) return
    setBusy(true);setError('');setRatingMessage('')
    try {
      const response=await fetch(`${API_BASE}/ratings`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({productId:active.productId,stars:rating,comment:review})})
      const summary=await readApiResponse(response)
      setRatingMessage(`Thanks! Seller rating is now ${summary.average.toFixed(1)} (${summary.count} ratings).`)
      setReview('')
    } catch(err) { setError(err.message) } finally { setBusy(false) }
  }
  if(!user) return <div className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-3xl font-black">Log in to see your messages</h1><Link to="/login" className="mt-5 inline-block rounded-xl bg-teal px-5 py-3 font-bold text-white">Log in</Link></div>
  const otherName=active?(active.buyerId===user.id?active.sellerName:active.buyerName):''
  const unreadTotal=conversations.reduce((sum,conversation)=>sum+(conversation.unreadCount||0),0)
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 lg:px-8"><h1 className="text-3xl font-black sm:text-4xl">Messages</h1><p className="mt-2 text-ink/55">Talk directly with buyers and sellers, and negotiate a fair price.</p>{error&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}<div className="mt-8 grid min-h-[520px] overflow-hidden rounded-2xl bg-white shadow-sm md:grid-cols-[300px_1fr]"><aside className="border-b md:border-b-0 md:border-r"><div className="border-b p-4 font-bold">Conversations ({conversations.length}){unreadTotal>0&&<span className="ml-2 rounded-full bg-coral px-2 py-1 text-xs text-white">{unreadTotal} unread</span>}</div>{conversations.map(conversation=>{const name=conversation.buyerId===user.id?conversation.sellerName:conversation.buyerName;return <button key={conversation.id} onClick={()=>selectConversation(conversation)} className={`w-full border-b p-4 text-left hover:bg-mint/40 ${conversation.id===selectedId?'bg-mint/50':''}`}><span className="flex items-center justify-between gap-2"><b className="truncate text-sm">{name}</b>{conversation.unreadCount>0&&<span className="rounded-full bg-teal px-2 py-1 text-[10px] font-bold text-white">{conversation.unreadCount}</span>}</span><span className="mt-1 block truncate text-xs text-ink/50">{conversation.productTitle}</span><span className="mt-1 block truncate text-xs text-ink/45">{conversation.messages.at(-1)?.text||'Start a conversation'}</span></button>})}{!conversations.length&&<p className="p-4 text-sm text-ink/50">Booking requests and seller replies will appear here.</p>}</aside><section className="flex min-h-[500px] flex-col">{active?<><header className="border-b p-4"><b>{otherName}</b><p className="mt-1 text-xs text-ink/50">{active.productTitle} · Asking {formatINR(active.productPrice)}</p></header><div className="flex-1 space-y-3 overflow-y-auto p-5">{active.messages.map((message,index)=>{const own=message.senderId===user.id;return <div key={`${message.createdAt}-${index}`} className={`max-w-[85%] rounded-2xl p-3 text-sm ${own?'ml-auto bg-teal text-white':'bg-cream text-ink'}`}><p className="mb-1 text-xs font-bold opacity-70">{own?'You':message.senderName}</p><p>{message.text}</p>{message.offerAmount&&<p className="mt-2 rounded-lg bg-white/15 px-3 py-2 font-bold">Offer: {formatINR(message.offerAmount)}</p>}</div>})}</div>{active.buyerId===user.id&&<form onSubmit={submitRating} className="border-t bg-cream/60 p-4"><p className="text-sm font-bold">Rate {active.sellerName}</p><div className="mt-2 flex gap-1" role="radiogroup" aria-label="Seller rating">{[1,2,3,4,5].map(value=><button key={value} type="button" onClick={()=>setRating(value)} aria-label={`${value} stars`} aria-pressed={rating===value}><Star size={22} className={value<=rating?'text-amber-400':'text-ink/20'} fill={value<=rating?'currentColor':'none'}/></button>)}</div><textarea value={review} onChange={event=>setReview(event.target.value)} maxLength={500} className="mt-2 w-full rounded-xl bg-white p-3 text-sm" placeholder="Optional review (up to 500 characters)"/><button disabled={!rating||busy} className="mt-2 rounded-xl bg-teal px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy?'Saving…':'Submit rating'}</button>{ratingMessage&&<p className="mt-2 text-sm font-semibold text-teal">{ratingMessage}</p>}</form>}<form onSubmit={send} className="grid gap-2 border-t p-4 sm:grid-cols-[1fr_180px_auto]"><input value={text} onChange={event=>setText(event.target.value)} className="rounded-xl bg-cream px-4 py-3 outline-none" placeholder="Write a message..."/><input type="number" min="1" max={active.productPrice} value={offer} onChange={event=>setOffer(event.target.value)} className="rounded-xl bg-cream px-4 py-3 outline-none" placeholder="Offer amount (₹)"/><button disabled={busy||(!text.trim()&&!offer)} className="rounded-xl bg-teal px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'Sending…':'Send'}</button></form></>:<div className="grid flex-1 place-items-center p-8 text-center text-ink/50">{conversations.length?'Choose a conversation to view messages.':'When you book/message a listing, the conversation will appear here.'}</div>}</section></div></div>
}

createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>)
