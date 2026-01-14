import LoginPage from "../../../components/authentication/LoginPage";
import AuthTest from "@/tests/test_login";

export default function Page() {
    return <div><LoginPage /><AuthTest /></div>;
    //return <AuthTest />;
}


