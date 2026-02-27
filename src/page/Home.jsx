import Chat from "../components/Chat";

function Home() {
    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="w-1/4 bg-gray-200 p-4">
                <h2 className="text-xl font-bold mb-4">Menu</h2>
                <ul className="space-y-2">
                    <li>Chat</li>
                    <li>Amis</li>
                    <li>Groupes</li>
                    <li>Paramètres</li>
                </ul>
            </div>
            <div className="flex-1">
                <Chat />
            </div>
        </div>
    );
}
export default Home;